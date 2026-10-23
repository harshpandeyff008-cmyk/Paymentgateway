/**
 * UPI payment email parsing - ONE dedicated parser per provider.
 * (The owner explicitly rejected a single mixed universal parser:
 * "mixer theek nahi hai".)
 *
 * Structure:
 * - parseFamPayEmail(subject, body, date)  -> FamPay / FamApp / FamX
 * - parsePaytmEmail(subject, body, date)   -> Paytm Business
 * - parsePhonePeEmail(subject, body, date) -> PhonePe
 * - parseBankEmail(subject, body, date)    -> generic bank / GPay /
 *   other UPI alerts (fallback)
 * Each dedicated parser is COMPLETE and standalone: it cleans the
 * email, rejects debit alerts, runs its own provider-specific
 * extraction (its extract*Fields core below), and returns the common
 * result shape. There is no shared if/else extraction monster.
 * - parsePaymentEmail(subject, body, date, providerHint) is ONLY a
 *   thin dispatcher: it detects the provider (or honours
 *   providerHint), calls the matching dedicated parser, then applies
 *   the common label-free whole-text gateway-order-code post-step.
 *   It contains no provider extraction logic itself.
 *
 * Ground truth from the owner's real emails:
 * - FamApp ("You received ₹3000.01 in your FamX account"): NO UTR
 *   line, NO note field - FMPIB id + exact amount only.
 * - Paytm Business ("Rs. 600.00 paid at ..."): NO UTR, NO note
 *   field - Paytm Order ID (T... / NEF...) + exact amount only.
 */

function cleanEmailText(text = '') {
  return text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#8377;/gi, '₹')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

// Strict Debit / Outgoing Transaction Detection (credit alerts override it)
function isDebitOnly(rawText) {
  const hasDebitKeyword = /(?:successfully\s+paid|paid\s+(?:₹|₹|Rs\.?|INR|\d+[\d.,]*)\s+to|payment\s+to\b|payment\s+of\s+[\d.,₹\s]+\s+is\s+successful|you\s+have\s+(?:successfully\s+)?paid|you\s+(?:have\s+)?sent|sent\s+(?:₹|₹|Rs\.?|INR|\d+[\d.,]*)\s+to|transferred\s+(?:₹|₹|Rs\.?|INR|\d+[\d.,]*)\s+to|\bdebited\b|\bdebit\b|spent\s+on|withdrawn|deducted\s+from)/i.test(rawText);
  const hasExplicitCredit = /(?:successfully\s+received|received|credited\s+(?:by|with|to|for)|money\s+received|payment\s+received|settle\s+to\s+your\s+bank|credited\s+to\s+your\s+account|received\s*₹)/i.test(rawText);
  return hasDebitKeyword && !hasExplicitCredit;
}

function debitFailure(subject, rawText) {
  return {
    success: false,
    isDebit: true,
    amount: 0,
    utr: null,
    sender: null,
    error: 'Debit/outgoing transaction detected. Only incoming received amounts are counted in the gateway.',
    rawSubject: subject,
    rawSnippet: rawText.substring(0, 300)
  };
}

// Extract a gateway order code (ORD-XXXXXX / PLAN-...) from the email
// text. OWNER-CONFIRMED BEHAVIOUR: the UPI note is printed in payment
// emails WITHOUT any "Note:" label - only the note's content appears
// verbatim in the body (note "order id -aaaaa1" arrives as just
// "order id -aaaaa1", never "Note: order id -aaaaa1"). Extraction is
// therefore primarily a LABEL-FREE search of the entire text; the
// Note / Remarks / Comment / Description / Purpose label search is
// only an extra. This is the deterministic note-matching path: it is
// ADDITIONAL to amount matching, never the only path.
function extractGatewayOrderCode(rawText) {
  let gatewayOrderCode = null;
  let note = null;

  const noteMatch = rawText.match(/(?:Note|Remarks?|Comment|Description|Purpose)\s*[:\-]?\s*([^\n\r]+)/i);
  if (noteMatch) {
    note = noteMatch[1].trim();
    const nestedMatch = note.match(/\b(ORD-[A-Z0-9_\-]{4,15})\b/i) || note.match(/\b(PLAN-[A-Z0-9_\-]{4,15})\b/i);
    if (nestedMatch) gatewayOrderCode = nestedMatch[1].toUpperCase();
  }

  if (!gatewayOrderCode) {
    const directCodeMatch = rawText.match(/\b(ORD-[A-Z0-9_\-]{4,15})\b/i) ||
                            rawText.match(/\b(PLAN-[A-Z0-9_\-]{4,15})\b/i);
    if (directCodeMatch) gatewayOrderCode = directCodeMatch[1].toUpperCase();
  }

  return { gatewayOrderCode, note };
}

// ----------------------------------------------------
// FAMPAY / FAMAPP / FAMX field extraction (dedicated)
// ----------------------------------------------------
function extractFamPayFields(rawText) {
  let amount = null;
  let utr = null;
  let txnId = null;
  let sender = 'Unknown';
  let receiver = 'N/A';

  // Amount: the "successfully received" amount, e.g.
  // "You have successfully received \n ₹3000.01 \n from Aditya".
  // The lazy match stops at the FIRST currency figure after "received",
  // which precedes the "Updated Balance : ₹3070.81" figure, so the
  // balance is never mistaken for the payment amount.
  const amtMatch = rawText.match(/(?:successfully\s+received|received)[\s\S]*?(?:₹|₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
                   rawText.match(/(?:₹|₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));

  // Sender: e.g. from MEENA KUMARI or from Aditya
  const senderMatch = rawText.match(/from\s+([A-Za-z0-9\s._-]+?)(?=\s*(?:\n|\(|Transaction\s*ID|Txn\s*ID|Date|Updated\s*Balance|UTR|Purpose|UPI\s*Ref|$))/i);
  if (senderMatch) sender = senderMatch[1].trim();

  // Receiver: e.g. Hey Rajdeep Das,
  const receiverMatch = rawText.match(/Hey\s+([A-Za-z0-9\s._-]+?),/i);
  if (receiverMatch) receiver = receiverMatch[1].trim();

  // Transaction ID: FMPIB followed by DIGITS ONLY.
  // Real FamApp emails have NO UTR line — this FMPIB id is the only
  // payment reference. Restricting the capture to digits means HTML
  // stripped without whitespace ("...FMPIB6842248581Date :...") still
  // yields exactly "FMPIB6842248581" instead of gluing the next label
  // ("Date") onto the id, which the old [A-Za-z0-9]+ capture did.
  const fmpMatch = rawText.match(/(FMPIB\d{6,20})/i);
  if (fmpMatch) {
    txnId = fmpMatch[1].trim();
  } else {
    const txnMatch = rawText.match(/(?:Transaction\s*ID|Txn\.?\s*ID)\s*:\s*([A-Za-z0-9]+)/i);
    if (txnMatch) txnId = txnMatch[1].trim();
  }

  // UTR: ONLY when explicitly labelled UTR / UPI Ref. A bare 12-digit
  // search is deliberately NOT used for FamPay: it could capture an
  // unrelated number (support phone, balance fragments). When no
  // labelled UTR exists, the FMPIB id becomes the reference (see
  // buildResult: utr falls back to txnId).
  const utrDigits = rawText.match(/(?:UTR|UPI\s*Ref(?:erence)?(?:\s*No)?)\s*[:#]\s*([0-9]{12})(?![0-9])/i);
  if (utrDigits) {
    utr = utrDigits[1].trim();
  } else {
    const utrAlpha = rawText.match(/(?:UTR|UPI\s*Ref)\s*[:#]\s*([0-9A-Za-z]{6,25})/i);
    if (utrAlpha) {
      // Glued-HTML guard: "UTR :214771578746Purpose :..." must not glue
      // the next label onto a 12-digit UTR.
      const glued = utrAlpha[1].match(/^([0-9]{12})[A-Za-z]/);
      utr = (glued ? glued[1] : utrAlpha[1]).trim();
    }
  }

  return { amount, utr, txnId, sender, receiver };
}

// ----------------------------------------------------
// PAYTM BUSINESS field extraction (dedicated)
// ----------------------------------------------------
function extractPaytmFields(rawText, cleanSubject) {
  let amount = null;
  let utr = null;
  let txnId = null;
  let sender = 'Unknown';
  let receiver = 'N/A';

  const { gatewayOrderCode, note } = extractGatewayOrderCode(rawText);

  // Amount: e.g. Payment Received \n ₹ 600. Fallback: the subject line
  // itself carries it in current Paytm emails
  // ("Rs. 600.00 paid at Sep 12, 2026, 8:31 PM").
  const amtMatch = rawText.match(/Payment\s+Received[\s\S]*?(?:₹|₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
                   rawText.match(/(?:₹|₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
                   (cleanSubject || '').match(/(?:Rs\.?|INR|₹|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));

  // Sender: e.g. From \n BHIM UPI 9430XX@slc
  const senderMatch = rawText.match(/From\s*[\n\r\s:]*([^\n\r]+?)(?=\s*(?:\n\s*In Account of|\n\s*Order ID|\n\s*Transaction Count|$))/i) ||
                      rawText.match(/From\s*:?\s*(.+?)\s+(?:In Account of|Order\s*ID\s*:|Transaction Count)/i);
  if (senderMatch) sender = senderMatch[1].trim();

  // Receiver: In Account of \n HARSH PANDEY
  const receiverMatch = rawText.match(/In\s+Account\s+of\s*[\n\r\s:]*([^\n\r]+)/i) ||
                        rawText.match(/In\s+Account\s+of\s*:?\s*([A-Za-z0-9\s._-]+?)(?=\s+(?:Order\s*ID|Transaction|$))/i);
  if (receiverMatch) receiver = receiverMatch[1].trim();

  // Paytm Order ID: formats vary — T2609141307521577368395 (older) and
  // NEF1970b768a3bc4c039b93a57491bf020 (NEF hex, current). Real Paytm
  // emails carry NO UTR and NO note field, so this Order ID is the
  // payment reference; the gateway order code (above) is only present
  // when a variant email does print the UPI note.
  const orderMatch = rawText.match(/Order\s*ID\s*:\s*([A-Za-z0-9]+)/i) ||
                     rawText.match(/Txn(?:\.?\s*ID)?\s*:\s*([A-Za-z0-9]+)/i);
  if (orderMatch) txnId = orderMatch[1].trim();

  // UPI Ref / UTR (only when the variant email carries one)
  const utrMatch = rawText.match(/(?:UPI\s*Ref|UTR|Ref\s*No)\s*[:\s#]*([0-9a-zA-Z_-]{6,40})/i) ||
                   rawText.match(/\b([0-9]{12})\b/);
  if (utrMatch) utr = utrMatch[1].trim();

  return { amount, utr, txnId, gatewayOrderCode, note, sender, receiver };
}

// ----------------------------------------------------
// PHONEPE field extraction (core of parsePhonePeEmail)
// ----------------------------------------------------
function extractPhonePeFields(rawText) {
  let amount = null;
  let utr = null;
  let txnId = null;
  let sender = 'Unknown';
  let receiver = 'N/A';

  // Amount: e.g. Received ₹ 50.09
  const amtMatch = rawText.match(/Received[\s\S]*?(?:₹|₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
                   rawText.match(/(?:₹|₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));

  // Txn. ID: e.g. T2609301256309083331806
  const txnMatch = rawText.match(/Txn\.?\s*ID\s*:\s*([A-Za-z0-9]+)/i);
  if (txnMatch) txnId = txnMatch[1].trim();

  // Store Name: e.g. PANME SHOP
  const storeMatch = rawText.match(/Store\s*Name\s*:\s*([^\n\r]+)/i);
  if (storeMatch) receiver = storeMatch[1].trim();

  // Paid By: e.g. kirupri143@oksbi or from ROHIT VERMA via PhonePe
  const paidByMatch = rawText.match(/Paid\s*By\s*:\s*([^\n\r]+)/i) ||
                      rawText.match(/from\s+([A-Za-z0-9\s._-]+?)\s+(?:via|to)/i);
  if (paidByMatch) sender = paidByMatch[1].trim();

  // UTR: ONLY when explicitly labelled. Real PhonePe Business
  // emails carry NO UTR line at all - the Txn. ID above IS the
  // payment reference (buildResult falls back utr -> txnId, exactly
  // like FamPay's FMPIB). A bare 12-digit search is deliberately NOT
  // used: it could capture an unrelated number.
  const utrMatch = rawText.match(/(?:UPI\s*Ref|UTR|Ref\s*No)\s*:\s*([0-9a-zA-Z]+)/i);
  if (utrMatch) utr = utrMatch[1].trim();

  return { amount, utr, txnId, sender, receiver };
}

// ----------------------------------------------------
// BANK / GENERIC UPI field extraction (core of parseBankEmail)
// ----------------------------------------------------
function extractGenericFields(rawText) {
  let amount = null;
  let utr = null;
  let sender = 'Unknown';

  const amtMatch = rawText.match(/(?:received|credited)[\s\S]*?(?:₹|₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
                   rawText.match(/(?:₹|₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));

  const utrMatch = rawText.match(/(?:UPI Ref|UTR|Ref No|Txn ID)\s*[:\s#]*([0-9a-zA-Z]{10,25})/i) ||
                   rawText.match(/\b([0-9]{12})\b/);
  if (utrMatch) utr = utrMatch[1].trim();

  const senderMatch = rawText.match(/(?:from|by|received from)\s+([a-zA-Z0-9\s@._-]+?)(?:\s+(?:via|to|on|with|UPI|\.|\n|$))/i);
  if (senderMatch) sender = senderMatch[1].trim();

  return { amount, utr, txnId: null, sender, receiver: 'N/A' };
}

// Shared result builder (same public shape parsePaymentEmail always returned)
function buildResult(fields, { subject, date, provider, rawText }) {
  const amount = fields.amount;
  const utr = fields.utr || null;
  const txnId = fields.txnId || null;

  if (!amount || isNaN(amount) || amount <= 0) {
    return {
      success: false,
      isDebit: false,
      amount: 0,
      error: 'No valid received payment amount found in email',
      rawSubject: subject,
      rawSnippet: rawText.substring(0, 300)
    };
  }

  const finalUtr = utr || txnId || `AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  return {
    success: true,
    isDebit: false,
    amount,
    utr: finalUtr,
    rawUtr: utr,
    txnId,
    famPayTxnId: txnId,
    orderId: txnId,
    gatewayOrderCode: fields.gatewayOrderCode || null,
    note: fields.note || null,
    sender: fields.sender || 'Unknown',
    receiver: fields.receiver || 'N/A',
    sourceApp: fields.sourceApp,
    provider,
    receivedAt: date instanceof Date ? date : new Date(date),
    rawSubject: subject,
    rawSnippet: rawText.substring(0, 500),
    rawText
  };
}

// Common post-step: label-free whole-text gateway-order-code search.
// Applied by every dedicated parser AND by the dispatcher, so the
// gatewayOrderCode is populated for every provider (see the
// owner-confirmed behaviour note on extractGatewayOrderCode).
function applyLabelFreeOrderCode(result) {
  if (!result || !result.success || result.gatewayOrderCode) return result;
  const found = extractGatewayOrderCode(result.rawText || '');
  if (found.gatewayOrderCode) {
    result.gatewayOrderCode = found.gatewayOrderCode;
    if (!result.note) result.note = found.note;
  }
  return result;
}

/**
 * Dedicated FamPay / FamApp / FamX parser.
 * Real FamApp credit emails ("You received ₹3000.01 in your FamX
 * account") contain NO UTR line and NO note/purpose field — the FMPIB
 * transaction id is the payment reference, and matching relies on it
 * plus the exact (unique-paise) amount.
 */
export function parseFamPayEmail(subject = '', body = '', date = new Date()) {
  const cleanBody = cleanEmailText(body);
  const cleanSubject = cleanEmailText(subject);
  const rawText = `${cleanSubject}\n${cleanBody}`;

  if (isDebitOnly(rawText)) return debitFailure(subject, rawText);

  const fields = {
    ...extractFamPayFields(rawText),
    ...extractGatewayOrderCode(rawText),
    sourceApp: 'FamPay'
  };
  return applyLabelFreeOrderCode(buildResult(fields, { subject, date, provider: 'FamPay', rawText }));
}

/**
 * Dedicated Paytm Business parser.
 * Real Paytm credit emails carry NO UTR and NO note field — the Paytm
 * Order ID (T... / NEF... formats) is the payment reference. When a
 * variant email DOES carry the UPI note, the gateway order code is
 * extracted for deterministic note-based matching.
 */
export function parsePaytmEmail(subject = '', body = '', date = new Date()) {
  const cleanBody = cleanEmailText(body);
  const cleanSubject = cleanEmailText(subject);
  const rawText = `${cleanSubject}\n${cleanBody}`;

  if (isDebitOnly(rawText)) return debitFailure(subject, rawText);

  const fields = {
    ...extractPaytmFields(rawText, cleanSubject),
    sourceApp: 'Paytm Business'
  };
  return applyLabelFreeOrderCode(buildResult(fields, { subject, date, provider: 'Paytm Business', rawText }));
}

/**
 * Dedicated PhonePe Business parser, built to the owner's real
 * email: "Received ₹ 50.09 / Txn. ID : T2609301256309083331806 /
 * Store Name : PANME SHOP / Paid By : kirupri143@oksbi /
 * Txn. Status : Successful". Real PhonePe Business emails carry NO
 * UTR line and NO note field - the Txn. ID is the reference and the
 * exact paise amount (50.09) is the matching backbone. A present
 * "Txn. Status" that is not "Successful" is rejected outright.
 * (Personal PhonePe UPI payments - @ybl etc. - generate NO PhonePe
 * email; they arrive as bank alerts and go through parseBankEmail.)
 */
export function parsePhonePeEmail(subject = '', body = '', date = new Date()) {
  const cleanBody = cleanEmailText(body);
  const cleanSubject = cleanEmailText(subject);
  const rawText = `${cleanSubject}\n${cleanBody}`;

  if (isDebitOnly(rawText)) return debitFailure(subject, rawText);

  // Txn. Status guard: a failed / pending / reversed PhonePe
  // transaction must NEVER be counted as a received payment.
  const statusMatch = rawText.match(/Txn\.?\s*Status\s*:\s*([A-Za-z]+)/i);
  if (statusMatch && !/^successful$/i.test(statusMatch[1].trim())) {
    return {
      success: false,
      isDebit: false,
      amount: 0,
      utr: null,
      sender: null,
      error: `PhonePe Txn. Status is "${statusMatch[1]}" (not Successful) - not counted as a payment.`,
      rawSubject: subject,
      rawSnippet: rawText.substring(0, 300)
    };
  }

  const fields = {
    ...extractPhonePeFields(rawText),
    sourceApp: 'PhonePe'
  };
  return applyLabelFreeOrderCode(buildResult(fields, { subject, date, provider: 'PhonePe', rawText }));
}

/**
 * Dedicated generic bank / GPay / other-UPI-alert parser (fallback).
 * Covers Indian bank UPI credit alerts (HDFC, ICICI, SBI, Axis,
 * Kotak, BHIM) and any credit alert no dedicated parser claims.
 */
export function parseBankEmail(subject = '', body = '', date = new Date()) {
  const cleanBody = cleanEmailText(body);
  const cleanSubject = cleanEmailText(subject);
  const rawText = `${cleanSubject}\n${cleanBody}`;

  if (isDebitOnly(rawText)) return debitFailure(subject, rawText);

  const fields = {
    ...extractGenericFields(rawText),
    sourceApp: 'UPI'
  };
  return applyLabelFreeOrderCode(buildResult(fields, { subject, date, provider: 'UPI', rawText }));
}

/**
 * Thin dispatcher ONLY - no provider extraction logic lives here.
 * 1. Honour providerHint by forcing the matching dedicated parser
 *    (even when the email keywords are sparse, e.g. a FamX subject
 *    that never says "FamPay", or a merchant configured as PAYTM).
 * 2. Otherwise auto-detect the provider (detection only) and call
 *    its dedicated parser.
 * 3. Apply the common label-free whole-text gateway-order-code
 *    post-step for every provider.
 */
export function parsePaymentEmail(subject = '', body = '', date = new Date(), providerHint = 'AUTO') {
  const hint = String(providerHint || 'AUTO').toUpperCase();
  let result = null;

  if (hint.includes('PAYTM')) {
    result = parsePaytmEmail(subject, body, date);
  } else if (hint.includes('PHONEPE')) {
    result = parsePhonePeEmail(subject, body, date);
  } else if (hint.includes('FAM')) {
    result = parseFamPayEmail(subject, body, date);
  } else {
    const probe = `${cleanEmailText(subject)}\n${cleanEmailText(body)}`.toLowerCase();
    if (
      probe.includes('fampay') || probe.includes('famapp') || probe.includes('famx') ||
      probe.includes('fmpib') || probe.includes('famapp.in') ||
      (probe.includes('successfully received') && (probe.includes('fmpib') || probe.includes('utr') || probe.includes('transaction id')))
    ) {
      result = parseFamPayEmail(subject, body, date);
    } else if (
      probe.includes('paytm') || probe.includes('b.paytm.me') ||
      (probe.includes('payment received') && probe.includes('order id'))
    ) {
      result = parsePaytmEmail(subject, body, date);
    } else if (
      probe.includes('phonepe') || probe.includes('panme shop') ||
      probe.includes('merchant-desk@phonepe.com') ||
      (probe.includes('received') && probe.includes('paid by') && probe.includes('txn. id'))
    ) {
      result = parsePhonePeEmail(subject, body, date);
    } else {
      result = parseBankEmail(subject, body, date);
    }
  }

  // Legacy provider semantics: an explicit hint is echoed back.
  if (result && result.success && hint !== 'AUTO') {
    result.provider = providerHint;
  }

  // Common post-step (every provider): label-free order-code search.
  if (result && result.success) {
    result = applyLabelFreeOrderCode(result);
  }

  return result;
}

export default { parsePaymentEmail, parseFamPayEmail, parsePaytmEmail, parsePhonePeEmail, parseBankEmail };
