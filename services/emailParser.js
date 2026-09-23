/**
 * Universal UPI Email Parser specialized for Indian UPI payment alerts:
 * - Paytm (Paytm Business / Merchant emails with Order ID T...)
 * - PhonePe (PhonePe Merchant / Personal UPI with Txn ID / UTR)
 * - FamPay / FamApp (FMPIB... Txn ID / 12-digit UTR)
 * - Google Pay & Indian Bank UPI (HDFC, ICICI, SBI, Axis, Kotak, BHIM)
 */

export function parsePaymentEmail(subject = '', body = '', date = new Date(), providerHint = 'AUTO') {
  const rawText = `${subject}\n${body}`;

  // 1. Preprocess & normalize text
  const text = rawText
    .replace(/(successfully\s+received|received)/gi, ' $1 ')
    .replace(/(successfully\s+paid|paid)/gi, ' $1 ')
    .replace(/(from|to)\b/gi, ' $1 ')
    .replace(/(Transaction\s*ID|Txn\s*ID)/gi, ' $1 ')
    .replace(/(Order\s*ID)/gi, ' $1 ')
    .replace(/\b(Date)\b/gi, ' $1 ')
    .replace(/(Updated\s*Balance)/gi, ' $1 ')
    .replace(/(UTR)/gi, ' $1 ')
    .replace(/(Purpose)/gi, ' $1 ')
    .replace(/(Sent\s+using)/gi, ' $1 ')
    .replace(/(If\s+this)/gi, ' $1 ')
    .replace(/\s+/g, ' ');

  // 2. Strict Debit / Outgoing Transaction Detection
  const hasDebitKeyword = /(?:successfully\s+paid|paid\s+(?:₹|\u20B9|Rs\.?|INR|\d+[\d.,]*)\s+to|payment\s+to\b|payment\s+of\s+[\d.,₹\s]+\s+is\s+successful|you\s+have\s+(?:successfully\s+)?paid|you\s+(?:have\s+)?sent|sent\s+(?:₹|\u20B9|Rs\.?|INR|\d+[\d.,]*)\s+to|transferred\s+(?:₹|\u20B9|Rs\.?|INR|\d+[\d.,]*)\s+to|\bdebited\b|\bdebit\b|spent\s+on|withdrawn|deducted\s+from)/i.test(text);

  const hasExplicitCredit = /(?:successfully\s+received|received|credited\s+(?:by|with|to|for)|money\s+received|payment\s+received|settle\s+to\s+your\s+bank|credited\s+to\s+your\s+account)/i.test(text);

  if (hasDebitKeyword && !hasExplicitCredit) {
    return {
      success: false,
      isDebit: true,
      amount: 0,
      utr: null,
      sender: null,
      error: 'Debit/outgoing transaction detected. Only incoming received amounts are counted in the gateway.',
      rawSubject: subject,
      rawSnippet: text.substring(0, 300)
    };
  }

  // 3. Amount Extraction (Strictly Received / Credited)
  let amount = null;

  // Patterns for received amounts:
  // - "Payment Received \n ₹ 900" (Paytm)
  // - "You have successfully received ₹500.0 from..." (FamPay)
  // - "Payment received of ₹ 450.00" (PhonePe)
  // - "credited by/with ₹..." (Bank)
  const receivedAmountMatch = 
    text.match(/(?:successfully\s+)?received\s*(?:₹|\u20B9|Rs\.?|INR|[^\w\s.,]|\?)?\s*([\d,]+\.?\d*)/i) ||
    text.match(/payment\s+received\s*(?:₹|\u20B9|Rs\.?|INR|[^\w\s.,]|\?)?\s*([\d,]+\.?\d*)/i) ||
    text.match(/(?:credited\s+(?:by|with|for)?)\s*(?:₹|\u20B9|Rs\.?|INR|[^\w\s.,]|\?)?\s*([\d,]+\.?\d*)/i) ||
    text.match(/received\s+payment\s+of\s*(?:₹|\u20B9|Rs\.?|INR|[^\w\s.,]|\?)?\s*([\d,]+\.?\d*)/i);

  if (receivedAmountMatch && receivedAmountMatch[1]) {
    const parsed = parseFloat(receivedAmountMatch[1].replace(/,/g, ''));
    if (!isNaN(parsed) && parsed > 0) {
      amount = parsed;
    }
  }

  // Fallback credit symbol match if credit context exists
  if (!amount || isNaN(amount)) {
    if (hasExplicitCredit) {
      const fallbackMatch = text.match(/(?:₹|Rs\.?|INR)\s*([\d,]+\.?\d{0,2})/i);
      if (fallbackMatch && fallbackMatch[1]) {
        amount = parseFloat(fallbackMatch[1].replace(/,/g, ''));
      }
    }
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    return {
      success: false,
      isDebit: false,
      amount: 0,
      error: 'No valid received payment amount found in email',
      rawSubject: subject,
      rawSnippet: text.substring(0, 300)
    };
  }

  // 4. UTR (12-digit Banking Ref), Paytm Order ID, and PhonePe/FamPay Txn ID
  let utr = null;
  let txnId = null;

  // 4a. 12-digit UPI UTR / Ref Number
  const utrMatch = text.match(/UTR\s*[:\s#]*([0-9]{12})/i) ||
                   text.match(/UPI\s*Ref(?:\s*no\.?)?\s*[:\s#]*([0-9]{12})/i) ||
                   text.match(/Ref\s*(?:no\.?)?\s*[:\s#]*([0-9]{12})/i) ||
                   text.match(/Bank\s*Ref(?:\s*no\.?)?\s*[:\s#]*([0-9]{12})/i);

  if (utrMatch) {
    utr = utrMatch[1].trim();
  }

  // 4b. Paytm Merchant Order ID (e.g. Order ID: T2609141307521577368395)
  const orderIdMatch = text.match(/Order\s*ID\s*[:\s#]*([A-Za-z0-9_-]{8,35})/i);
  if (orderIdMatch) {
    txnId = orderIdMatch[1].trim();
  }

  // 4c. PhonePe / FamPay / Standard Transaction ID
  if (!txnId) {
    const txnMatch = text.match(/(?:UPI\s*)?Transaction\s*ID\s*[:\s#]*([A-Za-z0-9_-]{8,35})/i) ||
                     text.match(/Txn\s*ID\s*[:\s#]*([A-Za-z0-9_-]{8,35})/i);
    if (txnMatch) {
      txnId = txnMatch[1].trim().replace(/(?:Date|Updated|UTR)$/i, '');
    }
  }

  // 4d. FamPay internal pattern (FMPIB...)
  if (!txnId) {
    const famMatch = text.match(/\b(FMPIB[A-Za-z0-9]{6,20})\b/i);
    if (famMatch) txnId = famMatch[1].trim();
  }

  // 4e. Standalone 12-digit number if no UTR yet
  if (!utr) {
    const standaloneMatch = text.match(/\b([0-9]{12})\b/);
    if (standaloneMatch) {
      utr = standaloneMatch[1].trim();
    }
  }

  // Final UTR prioritized: 12-digit UTR > Order/Txn ID > Generated Auto fallback
  const finalUtr = utr || txnId || `AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // 5. Sender Extraction
  let sender = 'Unknown';

  // Check Paytm "In Account of\nHARSH PANDEY"
  const inAccountMatch = rawText.match(/In\s+Account\s+of\s*[\n\r]+\s*([A-Za-z\s]{2,40}?)(?:[\n\r]|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b|\d{1,2}:\d{2}|Order\s*ID|Txn|Transaction|UTR|UPI|$)/i);
  
  // Check "From\nBHIM UPI 5351XX@axl" or "From: ..."
  const fromBhimMatch = rawText.match(/From\s*[\n\r]+\s*(?:BHIM\s+UPI\s+)?([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)/i);

  // Standard "received from <Name>"
  const nameMatch = text.match(/received\s+[^\n]+?\s+from\s+([A-Za-z\s]{2,40}?)(?:\s+via|\s+at\s+\d{1,2}:\d{2}|\s*\(|\s*Transaction\s*ID|\s*Txn\s*ID|\s*\bDate\b|\s*UTR|\s*Order|\s*Updated|$)/i) ||
                    text.match(/from\s+([A-Za-z\s]{2,40}?)(?:\s+via|\s+at\s+\d{1,2}:\d{2}|\s*\(|\s*Transaction\s*ID|\s*Txn\s*ID|\s*\bDate\b|\s*UTR|\s*Order|\s*Updated|$)/i);
  
  const upiIdMatch = text.match(/from\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)/i) ||
                     text.match(/\(\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)\s*\)/i);

  if (inAccountMatch && inAccountMatch[1] && inAccountMatch[1].trim().length >= 2) {
    sender = inAccountMatch[1].trim();
  } else if (nameMatch && nameMatch[1] && nameMatch[1].trim().length >= 2) {
    const candidate = nameMatch[1].trim();
    if (!['you', 'your', 'account', 'customer', 'fampay', 'famapp', 'bhim'].includes(candidate.toLowerCase())) {
      sender = candidate;
    }
  } else if (fromBhimMatch && fromBhimMatch[1]) {
    sender = fromBhimMatch[1].trim();
  } else if (upiIdMatch && upiIdMatch[1]) {
    sender = upiIdMatch[1].trim();
  }

  // 6. Source App / Provider Recognition
  let sourceApp = 'UPI';
  const appMatch = text.match(/Sent\s+using\s+([A-Za-z0-9\s]+?)(?:\s+If\s+this|\s+Disclaimer|$)/i);
  if (appMatch && appMatch[1]) {
    sourceApp = appMatch[1].trim();
  } else if (/b\.paytm\.me|paytm\s+business|paytm/i.test(rawText)) {
    sourceApp = 'Paytm Business';
  } else if (/phonepe/i.test(rawText)) {
    sourceApp = 'PhonePe';
  } else if (/famapp|fampay/i.test(rawText)) {
    sourceApp = 'FamPay';
  } else if (/google\s*pay|gpay/i.test(rawText)) {
    sourceApp = 'Google Pay';
  } else if (/bhim/i.test(rawText)) {
    sourceApp = 'BHIM UPI';
  }

  return {
    success: true,
    isDebit: false,
    amount,
    utr: finalUtr,
    rawUtr: utr,
    txnId,
    famPayTxnId: txnId,
    orderId: orderIdMatch ? orderIdMatch[1].trim() : null,
    sender,
    sourceApp,
    provider: providerHint !== 'AUTO' ? providerHint : sourceApp,
    receivedAt: date instanceof Date ? date : new Date(date),
    rawSubject: subject,
    rawSnippet: text.substring(0, 300)
  };
}

export default { parsePaymentEmail };
