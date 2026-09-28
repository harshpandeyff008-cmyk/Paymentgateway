package com.example.adminapp.data

import java.util.UUID

data class AdminUser(
    val uid: String = "",
    val email: String,
    val role: String = "admin", // "superadmin" or "admin"
    val displayName: String = "",
    val mobile: String = "",
    val instagramId: String = "",
    val isRoot: Boolean = false,
    val selectedGmails: List<String> = emptyList(),
    val selectedZohos: List<String> = emptyList(),
    val selectedImaps: List<String> = emptyList(),
    val allowLicenseKeys: Boolean = true,
    val termsAccepted: Boolean = false,
    val termsAcceptedAt: String = ""
)

data class GarenaOtp(
    val id: String = UUID.randomUUID().toString(),
    val otpCode: String,
    val sender: String = "notice@garena.com",
    val recipientMailbox: String,
    val subject: String = "Garena Verification Code",
    val timestamp: Long = System.currentTimeMillis(),
    val isCopied: Boolean = false
)

enum class MailboxType {
    GMAIL,
    ZOHO,
    IMAP
}

data class ConnectedMailbox(
    val id: String = UUID.randomUUID().toString(),
    val email: String,
    val type: MailboxType,
    val host: String = "imap.gmail.com",
    val port: Int = 993,
    val isConnected: Boolean = true,
    val gameIdName: String? = null,
    val gameUid: String? = null,
    val assignedAdminId: String? = null,
    val assignedAdminEmail: String? = null,
    val lastSyncTime: Long = System.currentTimeMillis()
)

data class LicenseKey(
    val key: String,
    val duration: String, // "1 Day", "7 Days", "30 Days", "Lifetime"
    val status: String = "Active", // "Active", "Redeemed", "Expired"
    val createdAt: Long = System.currentTimeMillis(),
    val targetMailbox: String? = null,
    val redeemedBy: String? = null,
    val createdByEmail: String? = null,
    val createdByUid: String? = null,
    val createdByRole: String? = "admin"
)

data class MailMessage(
    val id: String = UUID.randomUUID().toString(),
    val sender: String,
    val recipient: String,
    val subject: String,
    val snippet: String,
    val body: String,
    val timestamp: Long = System.currentTimeMillis(),
    val otpCode: String? = null,
    val provider: MailboxType = MailboxType.IMAP
)

data class ClientItem(
    val uid: String,
    val name: String,
    val email: String,
    val mobile: String = "",
    val productName: String = "Free Fire Pro Access",
    val purchaseDate: String = "",
    val expiryDate: String = "",
    val validityDays: Int = 30,
    val status: String = "Active", // "Active", "Suspended", "Expired"
    val linkedGmail: String = "",
    val linkedZoho: String = "",
    val linkedImap: String = "",
    val password: String = "client12345",
    val gameUid: String = "",
    val mailboxDisabled: Boolean = false
)

data class SecurityAlert(
    val id: String = UUID.randomUUID().toString(),
    val targetEmail: String,
    val failedAttempts: Int,
    val maxAttempts: Int = 10,
    val isLocked: Boolean = false,
    val lockedUntilMs: Long = 0L,
    val timestamp: Long = System.currentTimeMillis(),
    val reason: String = "Failed password attempt recorded",
    val status: String = "Active"
)

data class LockoutStatus(
    val isLocked: Boolean,
    val failedAttempts: Int,
    val remainingTimeStr: String = "",
    val lockedUntilMs: Long = 0L
)

sealed class LockoutResult {
    data class AttemptRecorded(val attempts: Int, val remaining: Int) : LockoutResult()
    data class AccountLocked(val lockedUntilMs: Long, val totalAttempts: Int, val remainingTimeStr: String) : LockoutResult()
}

data class SupportChatSession(
    val clientUid: String,
    val clientName: String,
    val clientEmail: String,
    val status: String = "active", // "requesting", "active", "idle"
    val lastMessage: String = "",
    val updatedAt: Long = System.currentTimeMillis(),
    val unreadCount: Int = 0
)

data class SupportChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val senderId: String,
    val senderName: String,
    val text: String,
    val timestamp: Long = System.currentTimeMillis(),
    val isAdmin: Boolean = false
)


