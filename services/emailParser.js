/**
 * Universal UPI Email Parser specialized for Indian UPI payment alerts:
 * - FamPay / FamApp (FMPIB... Txn ID / 12-digit UTR)
 * - Paytm (Paytm Business / Merchant emails with Order ID T...)
 * - PhonePe (PhonePe Merchant / Personal UPI with Txn ID / UTR)
 * - Google Pay & Indian Bank UPI (HDFC, ICICI, SBI, Axis, Kotak, BHIM)
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

export function parsePaymentEmail(subject = '', body = '', date = new Date(), providerHint = 'AUTO') {
  const cleanBody = cleanEmailText(body);
  const cleanSubject = cleanEmailText(subject);
  const rawText = `${cleanSubject}\n${cleanBody}`;
  const textLower = rawText.toLowerCase();

  // 1. Strict Debit / Outgoing Transaction Detection
  const hasDebitKeyword = /(?:successfully\s+paid|paid\s+(?:₹|\u20B9|Rs\.?|INR|\d+[\d.,]*)\s+to|payment\s+to\b|payment\s+of\s+[\d.,₹\s]+\s+is\s+successful|you\s+have\s+(?:successfully\s+)?paid|you\s+(?:have\s+)?sent|sent\s+(?:₹|\u20B9|Rs\.?|INR|\d+[\d.,]*)\s+to|transferred\s+(?:₹|\u20B9|Rs\.?|INR|\d+[\d.,]*)\s+to|\bdebited\b|\bdebit\b|spent\s+on|withdrawn|deducted\s+from)/i.test(rawText);
  const hasExplicitCredit = /(?:successfully\s+received|received|credited\s+(?:by|with|to|for)|money\s+received|payment\s+received|settle\s+to\s+your\s+bank|credited\s+to\s+your\s+account|received\s*₹)/i.test(rawText);

  if (hasDebitKeyword && !hasExplicitCredit) {
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

  let sourceApp = 'UPI';
  let amount = null;
  let utr = null;
  let txnId = null;
  let sender = 'Unknown';
  let receiver = 'N/A';

  // ----------------------------------------------------
  // A. FAMPAY / FAMAPP
  // ----------------------------------------------------
  if (
    textLower.includes('fampay') || textLower.includes('famapp') ||
    (textLower.includes('successfully received') && (textLower.includes('fmpib') || textLower.includes('utr') || textLower.includes('transaction id')))
  ) {
    sourceApp = 'FamPay';

    // Amount: e.g. You have successfully received \n ₹600.0 or ₹ 600
    const amtMatch = rawText.match(/(?:successfully\s+received|received)[\s\S]*?(?:₹|\u20B9|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
                     rawText.match(/(?:₹|\u20B9|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));

    // Sender: e.g. from BIPIN KUMAR
    const senderMatch = rawText.match(/from\s+([A-Za-z0-9\s._@-]+?)(?=\s*(?:\n|Transaction\s*ID|Date|Updated\s*Balance|UTR|Purpose|$))/i);
    if (senderMatch) sender = senderMatch[1].trim();

    // Receiver: e.g. Hey Rajdeep Das,
    const receiverMatch = rawText.match(/Hey\s+([A-Za-z0-9\s._-]+?),/i);
    if (receiverMatch) receiver = receiverMatch[1].trim();

    // Transaction ID: e.g. FMPIB6661614275
    const txnMatch = rawText.match(/(?:Transaction\s*ID|Txn\s*ID)\s*:\s*([A-Za-z0-9]+)/i) ||
                     rawText.match(/\b(FMPIB[A-Za-z0-9]{6,20})\b/i);
    if (txnMatch) txnId = (txnMatch[1] || txnMatch[0]).trim();

    // UTR: e.g. 110752261815
    const utrMatch = rawText.match(/UTR\s*:\s*([0-9a-zA-Z]+)/i) ||
                     rawText.match(/\b([0-9]{12})\b/);
    if (utrMatch) utr = utrMatch[1].trim();
  }

  // ----------------------------------------------------
  // B. PAYTM (Paytm For Business / UPI)
  // ----------------------------------------------------
  else if (
    textLower.includes('paytm') || textLower.includes('b.paytm.me') ||
    (textLower.includes('payment received') && textLower.includes('order id'))
  ) {
    sourceApp = 'Paytm Business';

    // Amount: e.g. Payment Received \n ₹ 900
    const amtMatch = rawText.match(/Payment\s+Received[\s\S]*?(?:₹|\u20B9|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
                     rawText.match(/(?:₹|\u20B9|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));

    // Sender: e.g. From BHIM UPI 5351XX@axl
    const senderMatch = rawText.match(/From\s*[\n\r\s:]*([^\n\r]+?)(?=\s*(?:\n\s*In Account of|\n\s*Order ID|\n\s*Transaction Count|$))/i);
    if (senderMatch) sender = senderMatch[1].trim();

    // Receiver: In Account of HARSH PANDEY
    const receiverMatch = rawText.match(/In\s+Account\s+of\s*[\n\r\s:]*([^\n\r]+)/i);
    if (receiverMatch) receiver = receiverMatch[1].trim();

    // Order ID: e.g. T2609141307521577368395
    const orderMatch = rawText.match(/Order\s*ID\s*:\s*([A-Za-z0-9]+)/i) ||
                       rawText.match(/Txn(?: ID)?\s*:\s*([A-Za-z0-9]+)/i);
    if (orderMatch) txnId = orderMatch[1].trim();

    // UPI Ref / UTR
    const utrMatch = rawText.match(/(?:UPI\s*Ref|UTR|Ref\s*No)\s*:\s*([0-9a-zA-Z]+)/i) ||
                     rawText.match(/\b([0-9]{12})\b/);
    if (utrMatch) utr = utrMatch[1].trim();
  }

  // ----------------------------------------------------
  // C. PHONEPE (PhonePe Merchant / Personal)
  // ----------------------------------------------------
  else if (
    textLower.includes('phonepe') || textLower.includes('panme shop') ||
    textLower.includes('merchant-desk@phonepe.com') ||
    (textLower.includes('received') && textLower.includes('paid by') && textLower.includes('txn. id'))
  ) {
    sourceApp = 'PhonePe';

    // Amount: e.g. Received ₹ 50.09
    const amtMatch = rawText.match(/Received[\s\S]*?(?:₹|\u20B9|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
                     rawText.match(/(?:₹|\u20B9|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));

    // Txn. ID: e.g. T2609301256309083331806
    const txnMatch = rawText.match(/Txn\.?\s*ID\s*:\s*([A-Za-z0-9]+)/i);
    if (txnMatch) txnId = txnMatch[1].trim();

    // Store Name: e.g. PANME SHOP
    const storeMatch = rawText.match(/Store\s*Name\s*:\s*([^\n\r]+)/i);
    if (storeMatch) receiver = storeMatch[1].trim();

    // Paid By: e.g. kirupri143@oksbi
    const paidByMatch = rawText.match(/Paid\s*By\s*:\s*([^\n\r]+)/i);
    if (paidByMatch) sender = paidByMatch[1].trim();
  }

  // ----------------------------------------------------
  // D. GENERIC / BANK UPI FALLBACK
  // ----------------------------------------------------
  else {
    const amtMatch = rawText.match(/(?:received|credited)[\s\S]*?(?:₹|\u20B9|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
                     rawText.match(/(?:₹|\u20B9|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g, ''));

    const utrMatch = rawText.match(/(?:UPI Ref|UTR|Ref No|Txn ID)\s*[:\s#]*([0-9a-zA-Z]{10,25})/i) ||
                     rawText.match(/\b([0-9]{12})\b/);
    if (utrMatch) utr = utrMatch[1].trim();

    const senderMatch = rawText.match(/(?:from|by|received from)\s+([a-zA-Z0-9\s@._-]+?)(?:\s+(?:via|to|on|with|UPI|\.|\n|$))/i);
    if (senderMatch) sender = senderMatch[1].trim();
  }

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
    sender,
    receiver,
    sourceApp,
    provider: providerHint !== 'AUTO' ? providerHint : sourceApp,
    receivedAt: date instanceof Date ? date : new Date(date),
    rawSubject: subject,
    rawSnippet: rawText.substring(0, 300)
  };
}

export default { parsePaymentEmail };
