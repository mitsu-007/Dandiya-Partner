/**
 * Normalizes a phone number, validates format, and opens the official
 * WhatsApp click-to-chat URL with prefilled Garba Saathi match message.
 */
export function openWhatsApp(phoneNumber: string): void {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    throw new Error("No WhatsApp contact number provided.");
  }

  // Remove spaces, plus signs, hyphens, brackets, and non-digit characters
  const digits = String(phoneNumber).replace(/\D/g, "");

  if (!digits || digits.length < 10) {
    throw new Error("Invalid phone number format. Please check WhatsApp number.");
  }

  // Normalize Indian 10-digit phone numbers by prepending country code 91
  const normalizedNumber = digits.length === 10 ? `91${digits}` : digits;

  const message =
    "Hey! 👋 We connected on Garba Saathi! 💃🕺 Ready for Dandiya Night?";

  const url = `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(message)}`;

  try {
    const newWin = window.open(url, "_blank", "noopener,noreferrer");
    if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
      window.location.href = url;
    }
  } catch {
    window.location.href = url;
  }
}
