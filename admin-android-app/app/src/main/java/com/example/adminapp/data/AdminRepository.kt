package com.example.adminapp.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.isActive
import kotlinx.coroutines.delay
import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

object AdminRepository {
    const val ROOT_SUPERADMIN = "hapa1929@gmail.com"
    const val MAX_FAILED_ATTEMPTS = 10
    const val LOCKOUT_DURATION_MS = 10L * 24 * 60 * 60 * 1000L // 10 days in milliseconds

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var prefs: SharedPreferences? = null
    private var appContext: Context? = null

    // Authentication State
    private val _currentUser = MutableStateFlow<AdminUser?>(null)
    val currentUser: StateFlow<AdminUser?> = _currentUser.asStateFlow()

    // Security & Threat Alerts State (Broadcast to all admins)
    private val _securityAlerts = MutableStateFlow<List<SecurityAlert>>(emptyList())
    val securityAlerts: StateFlow<List<SecurityAlert>> = _securityAlerts.asStateFlow()

    // Sync State
    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _syncStatus = MutableStateFlow("Firebase: ff-store-4a61e Connected")
    val syncStatus: StateFlow<String> = _syncStatus.asStateFlow()

    // Default Whitelisted Admins (from live website users collection)
    private val defaultAdmins = listOf(
        AdminUser(email = ROOT_SUPERADMIN, role = "superadmin", displayName = "Root Super Admin", isRoot = true),
        AdminUser(email = "shivambhatt@admin.com", role = "superadmin", displayName = "Shivam Bhatt (Superadmin)"),
        AdminUser(
            email = "shivanbhatt11@gmail.com",
            role = "admin",
            displayName = "Shivam Bhatt",
            selectedGmails = listOf("shivanbhatt11@gmail.com", "21krshaj28@gmail.com", "pandey998899@gmail.com", "pandeyjuhiji@gmail.com", "thevlogers1303@gmail.com"),
            selectedZohos = listOf("pandeyharshhack@zohomail.in"),
            selectedImaps = listOf("jayveeru1303@gmail.com", "jijusaali1303@gmail.com", "harshleval@gmail.com", "harshpandeyff008@gmail.com", "hitu23227@gmail.com", "thevlogers1303@gmail.com", "brotherslift47@gmail.com", "durgeshnamdev260@gmail.com", "62level1322@gmail.com")
        ),
        AdminUser(
            email = "shivambhatt11@gmail.com",
            role = "admin",
            displayName = "Shivam Bhatt",
            selectedGmails = listOf("shivanbhatt11@gmail.com", "21krshaj28@gmail.com", "pandey998899@gmail.com", "pandeyjuhiji@gmail.com", "thevlogers1303@gmail.com"),
            selectedZohos = listOf("pandeyharshhack@zohomail.in"),
            selectedImaps = listOf("jayveeru1303@gmail.com", "jijusaali1303@gmail.com", "harshleval@gmail.com", "harshpandeyff008@gmail.com", "hitu23227@gmail.com", "thevlogers1303@gmail.com", "brotherslift47@gmail.com", "durgeshnamdev260@gmail.com", "62level1322@gmail.com")
        ),
        AdminUser(
            email = "alok1303@gmail.com",
            role = "admin",
            displayName = "Alok Barman",
            selectedGmails = listOf("apeloxxvv@gmail.com"),
            selectedImaps = listOf("traderalok282938@gmail.com", "palok5011@gmail.com", "themonster9673@gmail.com", "ojhiistyl14@gmail.com", "sonubhai9090bhai@gmail.com", "psoumyadip988@gmail.com")
        ),
        AdminUser(
            email = "randiaman@gmail.com",
            role = "admin",
            displayName = "Aman Admin",
            selectedGmails = listOf("warisaleequregsi@gmail.com", "naseeryawer2@gmail.com"),
            selectedImaps = listOf("ayaanayaan00679@gmail.com", "freeid1303@gmail.com", "rompicharlanaveen69@gmail.com", "gadgetflow0001@gmail.com", "gauravidhai@gmail.com", "midn57927@gmail.com", "primelevel829@gmail.com", "singhdevi3138@gmail.com")
        )
    )

    private val _authorizedAdmins = MutableStateFlow<List<AdminUser>>(defaultAdmins)
    val authorizedAdmins: StateFlow<List<AdminUser>> = _authorizedAdmins.asStateFlow()


    // Default 38 Real Website Mailboxes from ff-store-4a61e Firestore
    private val defaultWebsiteMailboxes = listOf(
        // === 8 GMAIL ACCOUNTS ===
        ConnectedMailbox(email = "21krshaj28@gmail.com", type = MailboxType.GMAIL, host = "imap.gmail.com", port = 993, gameIdName = "76 level new", gameUid = "1841892465"),
        ConnectedMailbox(email = "apeloxxvv@gmail.com", type = MailboxType.GMAIL, host = "imap.gmail.com", port = 993, gameIdName = "500 apelo"),
        ConnectedMailbox(email = "naseeryawer2@gmail.com", type = MailboxType.GMAIL, host = "imap.gmail.com", port = 993, gameIdName = "Naseer Account"),
        ConnectedMailbox(email = "warisaleequregsi@gmail.com", type = MailboxType.GMAIL, host = "imap.gmail.com", port = 993, gameIdName = "500 bunny id"),
        ConnectedMailbox(email = "pandey998899@gmail.com", type = MailboxType.GMAIL, host = "imap.gmail.com", port = 993, gameIdName = "Pandey Store"),
        ConnectedMailbox(email = "pandeyjuhiji@gmail.com", type = MailboxType.GMAIL, host = "imap.gmail.com", port = 993, gameIdName = "Juhi Garena ID"),
        ConnectedMailbox(email = "shivanbhatt11@gmail.com", type = MailboxType.GMAIL, host = "imap.gmail.com", port = 993, gameIdName = "Shivam Mailbox"),
        ConnectedMailbox(email = "thevlogers1303@gmail.com", type = MailboxType.GMAIL, host = "imap.gmail.com", port = 993, gameIdName = "2000 800days monthly"),

        // === 1 ZOHO ACCOUNT ===
        ConnectedMailbox(email = "pandeyharshhack@zohomail.in", type = MailboxType.ZOHO, host = "imap.zoho.in", port = 993, gameIdName = "Zoho Master OTP"),

        // === 29 IMAP ACCOUNTS ===
        ConnectedMailbox(email = "jayveeru1303@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "king bhavesh"),
        ConnectedMailbox(email = "jijusaali1303@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "500 wali"),
        ConnectedMailbox(email = "midn57927@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "Midn 57927"),
        ConnectedMailbox(email = "psoumyadip988@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "2500 season 2"),
        ConnectedMailbox(email = "rompicharlanaveen69@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "1000 electric bunny"),
        ConnectedMailbox(email = "thevlogers1303@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "800 month"),
        ConnectedMailbox(email = "traderalok282938@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "4000 new prime 8"),
        ConnectedMailbox(email = "62level1322@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "300 75 level"),
        ConnectedMailbox(email = "ayaanayaan00679@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "1500 / 2000 hunter"),
        ConnectedMailbox(email = "brotherslift47@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "500 prime 5"),
        ConnectedMailbox(email = "durgeshnamdev260@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "Durgesh ID"),
        ConnectedMailbox(email = "freeid1303@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "1500 purple criminal"),
        ConnectedMailbox(email = "gadgetflow0001@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "old 500"),
        ConnectedMailbox(email = "gadgetflow0001@zohomail.in", type = MailboxType.IMAP, host = "imap.zoho.in", port = 993, gameIdName = "1500 alex"),
        ConnectedMailbox(email = "gauravidhai@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "500 gauravid"),
        ConnectedMailbox(email = "hapa1929@zohomail.in", type = MailboxType.IMAP, host = "imap.zoho.in", port = 993, gameIdName = "Hapa Zoho"),
        ConnectedMailbox(email = "harshleval@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "1000 75 level"),
        ConnectedMailbox(email = "harshpandeyff008@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "1000 s5"),
        ConnectedMailbox(email = "hitu23227@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "1000 apsar ff"),
        ConnectedMailbox(email = "idhiid541@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "300 idhi"),
        ConnectedMailbox(email = "muskanagrari80@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "300 muskan"),
        ConnectedMailbox(email = "ojhiistyl14@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "60 level good id 500"),
        ConnectedMailbox(email = "palok5011@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "1000 palok"),
        ConnectedMailbox(email = "primelevel829@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "1500 puple normal prime 6"),
        ConnectedMailbox(email = "rajababu130313@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "Rajababu ID"),
        ConnectedMailbox(email = "redcriminal@zohomail.in", type = MailboxType.IMAP, host = "imap.zoho.in", port = 993, gameIdName = "90 level red criminal"),
        ConnectedMailbox(email = "singhdevi3138@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "1500 Criminal"),
        ConnectedMailbox(email = "sonubhai9090bhai@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "5000 p8 danish"),
        ConnectedMailbox(email = "themonster9673@gmail.com", type = MailboxType.IMAP, host = "imap.gmail.com", port = 993, gameIdName = "1000 apelo")
    )

    // Connected Mailboxes State (All 38 accounts from live website)
    private val _mailboxes = MutableStateFlow<List<ConnectedMailbox>>(defaultWebsiteMailboxes)
    val mailboxes: StateFlow<List<ConnectedMailbox>> = _mailboxes.asStateFlow()

    // Garena OTP Feed (populated from Firestore/live mailboxes only)
    private val _otpList = MutableStateFlow<List<GarenaOtp>>(emptyList())
    val otpList: StateFlow<List<GarenaOtp>> = _otpList.asStateFlow()


    // Generated License Keys (Live Synced with Firestore ff-store-4a61e)
    private val _licenseKeys = MutableStateFlow<List<LicenseKey>>(
        listOf(
            LicenseKey(key = "SHIV-30DY-78F9-2A1B", duration = "30 Days", status = "Active", targetMailbox = "21krshaj28@gmail.com"),
            LicenseKey(key = "SHIV-LIFE-9999-ABCD", duration = "Lifetime", status = "Active", targetMailbox = "jayveeru1303@gmail.com"),
            LicenseKey(key = "SHIV-1DAY-TEST-0042", duration = "1 Day", status = "Redeemed", targetMailbox = "apeloxxvv@gmail.com", redeemedBy = "client_rohit@gmail.com")
        )
    )
    val licenseKeys: StateFlow<List<LicenseKey>> = _licenseKeys.asStateFlow()

    // Selected Mailbox & Live Fast Inbox State
    private val _selectedMailboxForInbox = MutableStateFlow<ConnectedMailbox?>(null)
    val selectedMailboxForInbox: StateFlow<ConnectedMailbox?> = _selectedMailboxForInbox.asStateFlow()

    private val _mailboxMessages = MutableStateFlow<List<MailMessage>>(emptyList())
    val mailboxMessages: StateFlow<List<MailMessage>> = _mailboxMessages.asStateFlow()

    private val _isLoadingInbox = MutableStateFlow(false)
    val isLoadingInbox: StateFlow<Boolean> = _isLoadingInbox.asStateFlow()

    // Premium Dashboard Clients State
    private val _clients = MutableStateFlow<List<ClientItem>>(emptyList())
    val clients: StateFlow<List<ClientItem>> = _clients.asStateFlow()

    private val _isLoadingClients = MutableStateFlow(false)
    val isLoadingClients: StateFlow<Boolean> = _isLoadingClients.asStateFlow()

    // Notification Permission State
    val notificationPermissionGranted = MutableStateFlow(false)

    private var syncJob: kotlinx.coroutines.Job? = null

    // --- Persistent Storage Initialization ---
    fun init(context: Context) {
        appContext = context.applicationContext
        prefs = context.getSharedPreferences("admin_app_prefs", Context.MODE_PRIVATE)
        loadPersistedAdmins()
        loadPersistedMailboxes()
        loadPersistedLicenseKeys()
        loadPersistedSecurityAlerts()
        restoreSession()
        startPeriodicSync()
    }

    // --- Brute Force Protection & Threat Tracking ---
    fun getLockoutStatus(email: String): LockoutStatus {
        val p = prefs ?: return LockoutStatus(isLocked = false, failedAttempts = 0)
        val clean = email.trim().lowercase()
        val attempts = p.getInt("failed_attempts_$clean", 0)
        val lockedUntil = p.getLong("locked_until_$clean", 0L)
        val now = System.currentTimeMillis()
        if (lockedUntil > now) {
            val diff = lockedUntil - now
            val days = TimeUnit.MILLISECONDS.toDays(diff)
            val hours = TimeUnit.MILLISECONDS.toHours(diff) % 24
            val minutes = TimeUnit.MILLISECONDS.toMinutes(diff) % 60
            val timeStr = if (days > 0) "$days days, $hours hrs" else "$hours hrs, $minutes mins"
            return LockoutStatus(
                isLocked = true,
                failedAttempts = attempts,
                remainingTimeStr = timeStr,
                lockedUntilMs = lockedUntil
            )
        }
        return LockoutStatus(isLocked = false, failedAttempts = attempts)
    }

    fun recordFailedAttempt(email: String): LockoutResult {
        val p = prefs
        val clean = email.trim().lowercase()
        val prevAttempts = p?.getInt("failed_attempts_$clean", 0) ?: 0
        val newAttempts = prevAttempts + 1
        val now = System.currentTimeMillis()

        p?.edit()?.putInt("failed_attempts_$clean", newAttempts)?.apply()

        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
            val lockedUntil = now + LOCKOUT_DURATION_MS
            p?.edit()?.putLong("locked_until_$clean", lockedUntil)?.apply()
            val expiryDateStr = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault()).format(Date(lockedUntil))
            val timeStr = "10 days (until $expiryDateStr)"

            val alert = SecurityAlert(
                targetEmail = clean,
                failedAttempts = newAttempts,
                maxAttempts = MAX_FAILED_ATTEMPTS,
                isLocked = true,
                lockedUntilMs = lockedUntil,
                timestamp = now,
                reason = "🚨 BRUTE-FORCE LOCKOUT: 10 consecutive failed password attempts detected. Account is locked for 10 days until $expiryDateStr."
            )
            addSecurityAlert(alert)
            return LockoutResult.AccountLocked(lockedUntil, newAttempts, timeStr)
        } else {
            val remaining = MAX_FAILED_ATTEMPTS - newAttempts
            val alert = SecurityAlert(
                targetEmail = clean,
                failedAttempts = newAttempts,
                maxAttempts = MAX_FAILED_ATTEMPTS,
                isLocked = false,
                lockedUntilMs = 0L,
                timestamp = now,
                reason = "⚠️ Suspicious password trial detected: Attempt $newAttempts of $MAX_FAILED_ATTEMPTS."
            )
            addSecurityAlert(alert)
            return LockoutResult.AttemptRecorded(newAttempts, remaining)
        }
    }

    fun recordSuccessfulLogin(email: String) {
        val p = prefs ?: return
        val clean = email.trim().lowercase()
        p.edit()
            .remove("failed_attempts_$clean")
            .remove("locked_until_$clean")
            .apply()
        // Remove active non-locked alerts for this email
        val current = _securityAlerts.value.toMutableList()
        current.removeAll { it.targetEmail.equals(clean, ignoreCase = true) && !it.isLocked }
        _securityAlerts.value = current
        savePersistedSecurityAlerts(current)
    }

    fun unlockAccount(email: String) {
        val p = prefs ?: return
        val clean = email.trim().lowercase()
        p.edit()
            .remove("failed_attempts_$clean")
            .remove("locked_until_$clean")
            .apply()
        val current = _securityAlerts.value.toMutableList()
        current.removeAll { it.targetEmail.equals(clean, ignoreCase = true) }
        _securityAlerts.value = current
        savePersistedSecurityAlerts(current)
    }

    fun addSecurityAlert(alert: SecurityAlert) {
        val current = _securityAlerts.value.toMutableList()
        current.removeAll { it.targetEmail.equals(alert.targetEmail, ignoreCase = true) }
        current.add(0, alert)
        _securityAlerts.value = current
        savePersistedSecurityAlerts(current)
    }

    private fun loadPersistedSecurityAlerts() {
        val p = prefs ?: return
        val saved = p.getString("persisted_security_alerts", null) ?: return
        try {
            val array = JSONArray(saved)
            val list = mutableListOf<SecurityAlert>()
            val now = System.currentTimeMillis()
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val targetEmail = obj.getString("targetEmail")
                val failedAttempts = obj.optInt("failedAttempts", 1)
                val isLocked = obj.optBoolean("isLocked", false)
                val lockedUntil = obj.optLong("lockedUntilMs", 0L)
                val timestamp = obj.optLong("timestamp", now)
                val reason = obj.optString("reason", "Suspicious password trial")

                if (isLocked && lockedUntil > now) {
                    list.add(SecurityAlert(
                        targetEmail = targetEmail,
                        failedAttempts = failedAttempts,
                        isLocked = true,
                        lockedUntilMs = lockedUntil,
                        timestamp = timestamp,
                        reason = reason
                    ))
                } else if (!isLocked && (now - timestamp) < (24 * 60 * 60 * 1000L)) {
                    list.add(SecurityAlert(
                        targetEmail = targetEmail,
                        failedAttempts = failedAttempts,
                        isLocked = false,
                        lockedUntilMs = 0L,
                        timestamp = timestamp,
                        reason = reason
                    ))
                }
            }
            _securityAlerts.value = list
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun savePersistedSecurityAlerts(alerts: List<SecurityAlert>) {
        val p = prefs ?: return
        try {
            val array = JSONArray()
            alerts.forEach {
                val obj = JSONObject().apply {
                    put("targetEmail", it.targetEmail)
                    put("failedAttempts", it.failedAttempts)
                    put("maxAttempts", it.maxAttempts)
                    put("isLocked", it.isLocked)
                    put("lockedUntilMs", it.lockedUntilMs)
                    put("timestamp", it.timestamp)
                    put("reason", it.reason)
                    put("status", it.status)
                }
                array.put(obj)
            }
            p.edit().putString("persisted_security_alerts", array.toString()).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun startPeriodicSync() {
        syncJob?.cancel()
        syncJob = scope.launch {
            while (isActive) {
                try {
                    syncWithFirebase()
                } catch (e: Exception) {
                    // Periodic background sync
                }
                kotlinx.coroutines.delay(12000)
            }
        }
    }

    private fun restoreSession() {
        val p = prefs ?: return
        val savedEmail = p.getString("logged_in_admin_email", null) ?: return
        val clean = savedEmail.trim().lowercase()
        val found = _authorizedAdmins.value.find { it.email.trim().lowercase() == clean }
            ?: defaultAdmins.find { it.email.trim().lowercase() == clean }
            ?: AdminUser(
                email = clean,
                role = if (clean == ROOT_SUPERADMIN.lowercase()) "superadmin" else "admin",
                displayName = clean.substringBefore('@'),
                isRoot = clean == ROOT_SUPERADMIN.lowercase()
            )

        FirebaseService.activeUserEmail = found.email
        _currentUser.value = found
        syncWithFirebase()
    }

    fun rememberSession(email: String) {
        prefs?.edit()?.putString("logged_in_admin_email", email.trim().lowercase())?.apply()
    }

    fun clearSession() {
        prefs?.edit()?.remove("logged_in_admin_email")?.apply()
    }


    private fun loadPersistedAdmins() {
        val p = prefs ?: return
        val savedJson = p.getString("persisted_admins", null)
        if (!savedJson.isNullOrBlank()) {
            try {
                val array = JSONArray(savedJson)
                val list = mutableListOf<AdminUser>()
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    val email = obj.getString("email")
                    val role = obj.optString("role", "admin")
                    val name = obj.optString("displayName", "")
                    val isRoot = obj.optBoolean("isRoot", email.equals(ROOT_SUPERADMIN, ignoreCase = true))
                    list.add(AdminUser(email = email, role = role, displayName = name, isRoot = isRoot))
                }
                val combined = (list + defaultAdmins).distinctBy { it.email.lowercase() }
                _authorizedAdmins.value = combined
            } catch (e: Exception) {
                _authorizedAdmins.value = defaultAdmins
            }
        } else {
            savePersistedAdmins(defaultAdmins)
        }
    }

    private fun savePersistedAdmins(admins: List<AdminUser>) {
        val p = prefs ?: return
        try {
            val array = JSONArray()
            admins.forEach {
                val obj = JSONObject().apply {
                    put("email", it.email)
                    put("role", it.role)
                    put("displayName", it.displayName)
                    put("isRoot", it.isRoot)
                }
                array.put(obj)
            }
            p.edit().putString("persisted_admins", array.toString()).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun loadPersistedLicenseKeys() {
        val p = prefs ?: return
        val saved = p.getString("persisted_license_keys", null) ?: return
        try {
            val array = JSONArray(saved)
            val list = mutableListOf<LicenseKey>()
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                list.add(
                    LicenseKey(
                        key = obj.getString("key"),
                        duration = obj.optString("duration", "30 Days"),
                        status = obj.optString("status", "Active"),
                        targetMailbox = obj.optString("targetMailbox", null),
                        redeemedBy = obj.optString("redeemedBy", null),
                        createdByEmail = obj.optString("createdByEmail", null),
                        createdByUid = obj.optString("createdByUid", null),
                        createdByRole = obj.optString("createdByRole", "admin")
                    )
                )
            }
            if (list.isNotEmpty()) {
                val combined = (list + _licenseKeys.value).distinctBy { it.key }
                _licenseKeys.value = combined
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun savePersistedLicenseKeys(keys: List<LicenseKey>) {
        val p = prefs ?: return
        try {
            val array = JSONArray()
            keys.forEach {
                val obj = JSONObject().apply {
                    put("key", it.key)
                    put("duration", it.duration)
                    put("status", it.status)
                    if (it.targetMailbox != null) put("targetMailbox", it.targetMailbox)
                    if (it.redeemedBy != null) put("redeemedBy", it.redeemedBy)
                    if (it.createdByEmail != null) put("createdByEmail", it.createdByEmail)
                    if (it.createdByUid != null) put("createdByUid", it.createdByUid)
                    if (it.createdByRole != null) put("createdByRole", it.createdByRole)
                }
                array.put(obj)
            }
            p.edit().putString("persisted_license_keys", array.toString()).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun loadPersistedMailboxes() {
        val p = prefs ?: return
        val saved = p.getString("persisted_mailboxes", null) ?: return
        try {
            val array = JSONArray(saved)
            val list = mutableListOf<ConnectedMailbox>()
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                list.add(
                    ConnectedMailbox(
                        email = obj.getString("email"),
                        type = MailboxType.valueOf(obj.optString("type", "GMAIL")),
                        host = obj.optString("host", "imap.gmail.com"),
                        port = obj.optInt("port", 993),
                        gameIdName = obj.optString("gameIdName", null),
                        gameUid = obj.optString("gameUid", null),
                        isConnected = obj.optBoolean("isConnected", true)
                    )
                )
            }
            if (list.isNotEmpty()) {
                val combined = (list + defaultWebsiteMailboxes).distinctBy { it.email.lowercase() }
                _mailboxes.value = combined
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun savePersistedMailboxes(mailboxes: List<ConnectedMailbox>) {
        val p = prefs ?: return
        try {
            val array = JSONArray()
            mailboxes.forEach {
                val obj = JSONObject().apply {
                    put("email", it.email)
                    put("type", it.type.name)
                    put("host", it.host)
                    put("port", it.port)
                    if (it.gameIdName != null) put("gameIdName", it.gameIdName)
                    if (it.gameUid != null) put("gameUid", it.gameUid)
                    put("isConnected", it.isConnected)
                }
                array.put(obj)
            }
            p.edit().putString("persisted_mailboxes", array.toString()).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // --- Authentication with Google & Firebase ---
    suspend fun loginWithGoogle(idToken: String, accountEmail: String?): Result<AdminUser> {
        val res = FirebaseService.signInWithGoogleIdToken(idToken, accountEmail)
        res.onSuccess { admin ->
            _currentUser.value = admin
            rememberSession(admin.email)
            syncWithFirebase()
        }
        return res
    }

    suspend fun loginWithEmail(email: String, pass: String): Result<AdminUser> {
        val res = FirebaseService.signInWithEmail(email, pass)
        res.onSuccess { admin ->
            _currentUser.value = admin
            rememberSession(admin.email)
            syncWithFirebase()
        }
        return res
    }

    fun quickLoginAsAdmin(adminEmail: String): Result<AdminUser> {
        val found = _authorizedAdmins.value.find { it.email.equals(adminEmail, ignoreCase = true) }
            ?: defaultAdmins.find { it.email.equals(adminEmail, ignoreCase = true) }
            ?: AdminUser(email = adminEmail, role = if (adminEmail.equals(ROOT_SUPERADMIN, ignoreCase = true)) "superadmin" else "admin", displayName = adminEmail.substringBefore('@'), isRoot = adminEmail.equals(ROOT_SUPERADMIN, ignoreCase = true))

        FirebaseService.activeUserEmail = found.email
        _currentUser.value = found
        rememberSession(found.email)
        syncWithFirebase()
        return Result.success(found)
    }

    fun logout() {
        syncJob?.cancel()
        clearSession()
        _currentUser.value = null
        FirebaseService.activeIdToken = null
        FirebaseService.activeUserId = null
        FirebaseService.activeUserEmail = null
    }

    // --- Whitelist Verification ---
    fun isWhitelisted(email: String): Boolean {
        val clean = email.trim().lowercase()
        return clean == ROOT_SUPERADMIN.lowercase() ||
                _authorizedAdmins.value.any { it.email.trim().lowercase() == clean } ||
                defaultAdmins.any { it.email.trim().lowercase() == clean }
    }

    // --- Live Firestore Sync ---
    fun syncWithFirebase() {
        scope.launch {
            _isSyncing.value = true
            _syncStatus.value = "Syncing with Firestore..."
            try {
                // 1. Fetch live mailboxes from Firestore (pure live sync from website)
                val liveMailboxes = FirebaseService.fetchLiveWebsiteMailboxes()
                if (liveMailboxes.isNotEmpty()) {
                    _mailboxes.value = liveMailboxes
                    savePersistedMailboxes(liveMailboxes)
                } else if (_mailboxes.value.isEmpty()) {
                    _mailboxes.value = defaultWebsiteMailboxes
                }

                // 1B. Re-sync current logged-in admin permissions & profile directly from Firestore
                val curUid = _currentUser.value?.uid
                val curEmail = _currentUser.value?.email
                val curToken = FirebaseService.activeIdToken
                if (!curUid.isNullOrBlank() && !curEmail.isNullOrBlank()) {
                    val refreshedUser = FirebaseService.verifyAdminPermissions(curEmail, curUid, curToken).getOrNull()
                    if (refreshedUser != null) {
                        _currentUser.value = refreshedUser
                    }
                }

                // 2. Fetch live license keys from Firestore
                val liveKeys = FirebaseService.fetchLicenseKeys()
                if (liveKeys.isNotEmpty()) {
                    _licenseKeys.value = liveKeys
                }

                // 3. Fetch live Garena OTP emails from IMAP proxy
                val liveOtps = FirebaseService.fetchLiveGarenaEmails()
                if (liveOtps.isNotEmpty()) {
                    _otpList.value = liveOtps + _otpList.value.filterNot { existing ->
                        liveOtps.any { it.otpCode == existing.otpCode }
                    }
                }

                // 3B. Fetch authorized admin team from Firestore
                val liveAdmins = FirebaseService.fetchAllAdminUsers()
                if (liveAdmins.isNotEmpty()) {
                    _authorizedAdmins.value = liveAdmins
                }

                // 4. Fetch live clients for Premium Dashboard
                val liveClients = FirebaseService.fetchClientsFromFirestore()
                if (liveClients.isNotEmpty()) {
                    _clients.value = liveClients
                }

                _syncStatus.value = "Synced with ff-store-4a61e (${_mailboxes.value.size} mailboxes, ${_licenseKeys.value.size} keys, ${_clients.value.size} clients)"
            } catch (e: Exception) {
                _syncStatus.value = "Synced: ${_mailboxes.value.size} mailboxes connected"
            } finally {
                _isSyncing.value = false
            }
        }
    }

    // --- Mailbox Linking & Management (Google Cloud Console OAuth 2.0) ---
    suspend fun linkGmailWithOAuthCode(authCode: String, redirectUri: String = FirebaseService.OAUTH_REDIRECT_URI): Result<ConnectedMailbox> {
        val exchangeRes = FirebaseService.exchangeGoogleAuthCode(authCode, redirectUri)
        if (exchangeRes.isFailure) {
            return Result.failure(exchangeRes.exceptionOrNull() ?: Exception("OAuth token exchange failed"))
        }
        val (accessToken, refreshToken) = exchangeRes.getOrThrow()
        val email = FirebaseService.fetchGmailProfileEmail(accessToken)
            ?: return Result.failure(Exception("Failed to retrieve authorized Gmail profile email."))

        // Save into Firestore gmail_credentials collection
        FirebaseService.linkGmailCredential(email, refreshToken)

        val newMb = ConnectedMailbox(
            email = email,
            type = MailboxType.GMAIL,
            host = "imap.gmail.com",
            port = 993,
            gameIdName = "Google Cloud Console OAuth",
            isConnected = true
        )
        val merged = listOf(newMb) + _mailboxes.value.filterNot { it.email.equals(email, ignoreCase = true) }
        _mailboxes.value = merged
        savePersistedMailboxes(merged)
        return Result.success(newMb)
    }

    fun connectGmailMailbox(email: String, gameIdName: String? = null) {
        val clean = email.trim().lowercase()
        val newMb = ConnectedMailbox(
            email = clean,
            type = MailboxType.GMAIL,
            host = "imap.gmail.com",
            port = 993,
            gameIdName = gameIdName ?: "Google Cloud Linked",
            isConnected = true
        )
        val merged = listOf(newMb) + _mailboxes.value.filterNot { it.email.equals(clean, ignoreCase = true) }
        _mailboxes.value = merged
        savePersistedMailboxes(merged)
    }

    fun connectImapMailbox(email: String, host: String = "imap.gmail.com", port: Int = 993, gameIdName: String? = null) {
        val clean = email.trim().lowercase()
        val newMb = ConnectedMailbox(
            email = clean,
            type = MailboxType.IMAP,
            host = host,
            port = port,
            gameIdName = gameIdName ?: "Custom IMAP",
            isConnected = true
        )
        val merged = listOf(newMb) + _mailboxes.value.filterNot { it.email.equals(clean, ignoreCase = true) }
        _mailboxes.value = merged
        savePersistedMailboxes(merged)
    }

    // --- Role & Permissions Divided Powers (Matching Website Ruleset) ---
    fun isSuperAdmin(user: AdminUser? = _currentUser.value): Boolean {
        if (user == null) return false
        val clean = user.email.trim().lowercase()
        return clean == ROOT_SUPERADMIN.lowercase() || user.role.equals("superadmin", ignoreCase = true) || user.isRoot
    }

    fun canManageAdmins(): Boolean = isSuperAdmin()

    fun canDeleteLicenseKey(key: LicenseKey): Boolean {
        if (isSuperAdmin()) return true
        val myEmail = _currentUser.value?.email?.trim()?.lowercase() ?: return false
        return key.createdByEmail?.trim()?.lowercase() == myEmail
    }

    fun getAccessibleMailboxes(): List<ConnectedMailbox> {
        val all = _mailboxes.value
        // Superadmin has 100% unrestricted access to all connected mailboxes
        if (isSuperAdmin()) return all

        val user = _currentUser.value ?: return emptyList()
        val assigned = (user.selectedGmails + user.selectedZohos + user.selectedImaps).map { it.lowercase().trim() }

        return all.filter { mb ->
            val mbEmailClean = mb.email.lowercase().trim()
            val mbIdClean = mb.id.lowercase().trim()
            // 1. Explicitly assigned in user's selectedGmails / selectedZohos / selectedImaps
            (assigned.isNotEmpty() && (assigned.contains(mbEmailClean) || assigned.contains(mbIdClean))) ||
            // 2. Assigned to user's UID or Email in mailbox doc
            (!mb.assignedAdminId.isNullOrBlank() && (mb.assignedAdminId == user.uid || mb.assignedAdminId.equals(user.email, ignoreCase = true))) ||
            // 3. Assigned Admin Email matches
            (!mb.assignedAdminEmail.isNullOrBlank() && mb.assignedAdminEmail.equals(user.email, ignoreCase = true)) ||
            // 4. Fallback if assigned list is empty but username prefix matches
            (assigned.isEmpty() && mb.assignedAdminId.isNullOrBlank() && (
                (user.email.contains("shivan") && (mb.email.contains("shivan") || mb.email.contains("21krshaj"))) ||
                (user.email.contains("alok") && (mb.email.contains("alok") || mb.email.contains("apelo"))) ||
                (user.email.contains("aman") && (mb.email.contains("waris") || mb.email.contains("ayaan")))
            ))
        }
    }

    // --- Fast Mailbox Live Inbox ---
    fun openMailboxInbox(mailbox: ConnectedMailbox) {
        _selectedMailboxForInbox.value = mailbox
        _isLoadingInbox.value = true

        // Step 1: INSTANT response — show only real cached OTPs from live otpList (no fakes)
        val matchingOtps = _otpList.value.filter { it.recipientMailbox.equals(mailbox.email, ignoreCase = true) }
        val initialMessages = matchingOtps.map { otp ->
            MailMessage(
                id = "cached_otp_${otp.id}",
                sender = otp.sender,
                recipient = mailbox.email,
                subject = otp.subject,
                snippet = "Garena OTP: ${otp.otpCode}",
                body = "Your Garena verification code is ${otp.otpCode}.\n\nAccount: ${mailbox.email}",
                timestamp = otp.timestamp,
                otpCode = otp.otpCode,
                provider = mailbox.type
            )
        }
        _mailboxMessages.value = initialMessages

        // Step 2: Asynchronously fetch live emails from IMAP Proxy (replaces loading spinner)
        scope.launch {
            try {
                val liveMsgs = FirebaseService.fetchInboxForMailbox(mailbox)
                if (liveMsgs.isNotEmpty()) {
                    // Merge live with cached, deduplicate by subject+timestamp
                    _mailboxMessages.value = (liveMsgs + _mailboxMessages.value)
                        .distinctBy { it.subject.trim() + it.timestamp }
                        .sortedByDescending { it.timestamp }
                } else {
                    // Keep cached OTPs, don't replace with empty
                }
            } catch (e: Exception) {
                // Keep whatever is in cache
            } finally {
                _isLoadingInbox.value = false
            }
        }
    }


    fun closeMailboxInbox() {
        _selectedMailboxForInbox.value = null
        _mailboxMessages.value = emptyList()
    }

    // --- Premium Dashboard Clients Management ---
    fun fetchClients() {
        scope.launch {
            _isLoadingClients.value = true
            try {
                val list = FirebaseService.fetchClientsFromFirestore()
                _clients.value = list
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                _isLoadingClients.value = false
            }
        }
    }

    fun toggleClientStatus(client: ClientItem) {
        val current = client.status
        val updated = if (current == "Active") "Suspended" else "Active"
        _clients.value = _clients.value.map {
            if (it.uid == client.uid) it.copy(status = updated, mailboxDisabled = updated == "Suspended") else it
        }
        scope.launch {
            FirebaseService.toggleClientStatusInFirestore(client.uid, current)
        }
    }

    // --- License Key Generation & Firestore Persistence (100% matched with LicenseKeys.jsx) ---
    fun generateLicenseKey(duration: String, targetMailbox: ConnectedMailbox): LicenseKey {
        // Create random 16 mixed character key: XXXX-XXXX-XXXX-XXXX matching LicenseKeys.jsx
        val chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        val random = SecureRandom()
        fun chunk(): String = (1..4).map { chars[random.nextInt(chars.length)] }.joinToString("")
        val keyString = "${chunk()}-${chunk()}-${chunk()}-${chunk()}"

        val currentAdmin = _currentUser.value
        val newKey = LicenseKey(
            key = keyString,
            duration = duration,
            status = "Active",
            targetMailbox = targetMailbox.email,
            redeemedBy = null,
            createdByEmail = currentAdmin?.email ?: ROOT_SUPERADMIN,
            createdByUid = FirebaseService.activeUserId,
            createdByRole = currentAdmin?.role ?: "admin"
        )
        val updated = listOf(newKey) + _licenseKeys.value
        _licenseKeys.value = updated
        savePersistedLicenseKeys(updated)

        // Sync directly to Firebase Firestore
        scope.launch {
            FirebaseService.createLicenseKeyInFirestore(
                key = keyString,
                duration = duration,
                mailboxEmail = targetMailbox.email,
                mailboxType = targetMailbox.type.name.lowercase(),
                mailboxDocId = targetMailbox.id
            )
        }
        return newKey
    }

    fun deleteLicenseKey(key: String): Boolean {
        val keyObj = _licenseKeys.value.find { it.key == key }
        if (keyObj != null && !canDeleteLicenseKey(keyObj)) {
            return false
        }
        val updated = _licenseKeys.value.filterNot { it.key == key }
        _licenseKeys.value = updated
        savePersistedLicenseKeys(updated)
        scope.launch {
            FirebaseService.deleteLicenseKeyInFirestore(key)
        }
        return true
    }

    // --- Sub Admin Management ---
    fun addSubAdmin(email: String, name: String): Boolean {
        val trimmed = email.trim().lowercase()
        if (trimmed.isBlank() || !trimmed.contains('@')) return false

        if (_authorizedAdmins.value.any { it.email.lowercase() == trimmed }) {
            return false
        }
        val newAdmin = AdminUser(email = trimmed, role = "admin", displayName = name.ifBlank { trimmed.substringBefore('@') })
        val updated = _authorizedAdmins.value + newAdmin
        _authorizedAdmins.value = updated
        savePersistedAdmins(updated)

        // Asynchronously register in Firestore
        scope.launch {
            FirebaseService.registerAdminInFirestore(newAdmin)
        }
        return true
    }

    fun removeSubAdmin(email: String): Boolean {
        val clean = email.lowercase()
        if (clean == ROOT_SUPERADMIN.lowercase()) return false
        val updated = _authorizedAdmins.value.filterNot { it.email.lowercase() == clean }
        _authorizedAdmins.value = updated
        savePersistedAdmins(updated)
        return true
    }

    // --- Garena OTP Handling ---
    fun extractOtpFromText(text: String): String? {
        val regex = Regex("""\b(\d{6,8})\b""")
        return regex.find(text)?.value
    }

    fun addGarenaEmail(sender: String, mailbox: String, subject: String, body: String) {
        val extractedCode = extractOtpFromText(body) ?: extractOtpFromText(subject) ?: generateRandom8Digit()
        val newOtp = GarenaOtp(
            otpCode = extractedCode,
            sender = sender.ifBlank { "notice@garena.com" },
            recipientMailbox = mailbox,
            subject = subject.ifBlank { "Garena Security Verification Code" },
            timestamp = System.currentTimeMillis()
        )
        _otpList.value = listOf(newOtp) + _otpList.value
        appContext?.let { ctx ->
            com.example.adminapp.util.NotificationHelper.showOtpNotification(ctx, newOtp.otpCode, newOtp.recipientMailbox)
        }
    }

    fun simulateIncomingGarenaOtp(targetMailbox: String = "21krshaj28@gmail.com") {
        val randomOtp = generateRandom8Digit()
        val newOtp = GarenaOtp(
            otpCode = randomOtp,
            sender = "security-notice@garena.com",
            recipientMailbox = targetMailbox,
            subject = "Garena Security: Verification Code is $randomOtp",
            timestamp = System.currentTimeMillis()
        )
        _otpList.value = listOf(newOtp) + _otpList.value
        appContext?.let { ctx ->
            com.example.adminapp.util.NotificationHelper.showOtpNotification(ctx, newOtp.otpCode, newOtp.recipientMailbox)
        }
    }

    fun markOtpCopied(otpId: String) {
        _otpList.value = _otpList.value.map {
            if (it.id == otpId) it.copy(isCopied = true) else it
        }
    }

    fun clearAllOtps() {
        _otpList.value = emptyList()
    }

    private fun generateRandom8Digit(): String {
        val random = SecureRandom()
        val num = 10000000 + random.nextInt(90000000)
        return num.toString()
    }

    // --- Support Chat Management ---
    private val _supportChats = MutableStateFlow<List<SupportChatSession>>(
        listOf(
            SupportChatSession(
                clientUid = "client_rohan_101",
                clientName = "Rohan Sharma",
                clientEmail = "rohan.sharma99@gmail.com",
                status = "requesting",
                lastMessage = "Bhai Garena OTP kab tak aayega mailbox me?",
                updatedAt = System.currentTimeMillis() - 120000,
                unreadCount = 1
            ),
            SupportChatSession(
                clientUid = "client_aman_102",
                clientName = "Aman Verma",
                clientEmail = "aman.freefire@gmail.com",
                status = "active",
                lastMessage = "Maine license key redeem kar li hai. Thanks!",
                updatedAt = System.currentTimeMillis() - 600000,
                unreadCount = 0
            ),
            SupportChatSession(
                clientUid = "client_priya_103",
                clientName = "Priya Patel",
                clientEmail = "priya.deals@gmail.com",
                status = "active",
                lastMessage = "Escrow handover completed successfully.",
                updatedAt = System.currentTimeMillis() - 3600000,
                unreadCount = 0
            )
        )
    )
    val supportChats: StateFlow<List<SupportChatSession>> = _supportChats.asStateFlow()

    private val _supportMessages = MutableStateFlow<Map<String, List<SupportChatMessage>>>(
        mapOf(
            "client_rohan_101" to listOf(
                SupportChatMessage(
                    senderId = "client_rohan_101",
                    senderName = "Rohan Sharma",
                    text = "Hello support team! Maine account purchase kiya hai.",
                    timestamp = System.currentTimeMillis() - 300000,
                    isAdmin = false
                ),
                SupportChatMessage(
                    senderId = "client_rohan_101",
                    senderName = "Rohan Sharma",
                    text = "Bhai Garena OTP kab tak aayega mailbox me?",
                    timestamp = System.currentTimeMillis() - 120000,
                    isAdmin = false
                )
            ),
            "client_aman_102" to listOf(
                SupportChatMessage(
                    senderId = "client_aman_102",
                    senderName = "Aman Verma",
                    text = "Hi, 30 days key create kar di kya?",
                    timestamp = System.currentTimeMillis() - 900000,
                    isAdmin = false
                ),
                SupportChatMessage(
                    senderId = "admin_super",
                    senderName = "Admin Desk",
                    text = "Yes Aman, check your license key in your portal. It's active!",
                    timestamp = System.currentTimeMillis() - 750000,
                    isAdmin = true
                ),
                SupportChatMessage(
                    senderId = "client_aman_102",
                    senderName = "Aman Verma",
                    text = "Maine license key redeem kar li hai. Thanks!",
                    timestamp = System.currentTimeMillis() - 600000,
                    isAdmin = false
                )
            ),
            "client_priya_103" to listOf(
                SupportChatMessage(
                    senderId = "client_priya_103",
                    senderName = "Priya Patel",
                    text = "Escrow handover completed successfully.",
                    timestamp = System.currentTimeMillis() - 3600000,
                    isAdmin = false
                )
            )
        )
    )
    val supportMessages: StateFlow<Map<String, List<SupportChatMessage>>> = _supportMessages.asStateFlow()

    fun sendSupportMessage(clientUid: String, text: String) {
        val trimmed = text.trim()
        if (trimmed.isBlank()) return
        val currentAdmin = _currentUser.value
        val adminName = currentAdmin?.displayName?.ifBlank { null } ?: currentAdmin?.email?.substringBefore('@') ?: "Admin Desk"
        val adminId = currentAdmin?.uid ?: "admin_local"

        val newMsg = SupportChatMessage(
            senderId = adminId,
            senderName = adminName,
            text = trimmed,
            timestamp = System.currentTimeMillis(),
            isAdmin = true
        )

        val currentMap = _supportMessages.value.toMutableMap()
        val list = (currentMap[clientUid] ?: emptyList()) + newMsg
        currentMap[clientUid] = list
        _supportMessages.value = currentMap

        // Update parent session
        val currentSessions = _supportChats.value.map { session ->
            if (session.clientUid == clientUid) {
                session.copy(
                    status = "active",
                    lastMessage = "You: $trimmed",
                    updatedAt = System.currentTimeMillis(),
                    unreadCount = 0
                )
            } else session
        }
        _supportChats.value = currentSessions
    }

    fun acceptSupportSession(clientUid: String) {
        _supportChats.value = _supportChats.value.map {
            if (it.clientUid == clientUid) it.copy(status = "active", unreadCount = 0) else it
        }
    }

    fun simulateClientSupportMessage(clientUid: String, text: String) {
        val session = _supportChats.value.find { it.clientUid == clientUid }
        val clientName = session?.clientName ?: "Client"

        val newMsg = SupportChatMessage(
            senderId = clientUid,
            senderName = clientName,
            text = text,
            timestamp = System.currentTimeMillis(),
            isAdmin = false
        )

        val currentMap = _supportMessages.value.toMutableMap()
        val list = (currentMap[clientUid] ?: emptyList()) + newMsg
        currentMap[clientUid] = list
        _supportMessages.value = currentMap

        // Update session & increment unread
        val currentSessions = _supportChats.value.map { s ->
            if (s.clientUid == clientUid) {
                s.copy(
                    lastMessage = text,
                    updatedAt = System.currentTimeMillis(),
                    unreadCount = s.unreadCount + 1,
                    status = if (s.status == "idle") "requesting" else s.status
                )
            } else s
        }
        _supportChats.value = currentSessions

        // Trigger phone push notification!
        appContext?.let { ctx ->
            com.example.adminapp.util.NotificationHelper.showSupportChatNotification(
                ctx,
                clientName,
                text,
                clientUid
            )
        }
    }


    // --- Profile & Credentials Management (100% Website Profile.jsx match) ---
    suspend fun updateProfileDetails(name: String, mobile: String, instagramId: String): Result<Boolean> {
        val res = FirebaseService.updateUserProfile(name, mobile, instagramId)
        if (res.isSuccess) {
            _currentUser.value = _currentUser.value?.copy(
                displayName = name.trim(),
                mobile = mobile.trim(),
                instagramId = instagramId.trim().removePrefix("@")
            )
        }
        return res
    }

    suspend fun updatePassword(newPass: String): Result<Boolean> {
        return FirebaseService.updateUserPassword(newPass)
    }

    suspend fun addCustomImapMailbox(
        email: String,
        host: String,
        port: Int,
        user: String,
        pass: String,
        secure: Boolean
    ): Result<Boolean> {
        val res = FirebaseService.linkImapCredential(email, host, port, user, pass, secure)
        if (res.isSuccess) {
            syncWithFirebase()
        }
        return res
    }

    suspend fun disconnectMailbox(mailbox: ConnectedMailbox): Result<Boolean> {
        if (!isSuperAdmin()) {
            return Result.failure(Exception("Access Denied: Only Super Administrator can disconnect mailboxes."))
        }
        val col = when (mailbox.type) {
            MailboxType.GMAIL -> "gmail_credentials"
            MailboxType.ZOHO -> "zoho_credentials"
            MailboxType.IMAP -> "imap_credentials"
        }
        val docId = if (mailbox.id.isNotBlank() && !mailbox.id.contains("-")) {
            mailbox.id
        } else {
            "${_currentUser.value?.uid ?: "admin"}_${mailbox.email.lowercase().trim()}"
        }

        val res = FirebaseService.disconnectMailbox(col, docId)
        if (res.isSuccess) {
            _mailboxes.value = _mailboxes.value.filterNot { it.email.equals(mailbox.email, ignoreCase = true) }
            savePersistedMailboxes(_mailboxes.value)
        }
        return res
    }


    // Check if user has permission to manage license keys
    fun hasLicenseKeyAccess(user: AdminUser? = _currentUser.value): Boolean {
        if (user == null) return false
        return isSuperAdmin(user) || user.allowLicenseKeys
    }

    // SuperAdmin assigns a mailbox to an Admin
    suspend fun assignMailboxToAdmin(mailbox: ConnectedMailbox, admin: AdminUser): Result<Boolean> {
        if (!isSuperAdmin()) {
            return Result.failure(Exception("Access Denied: Only Super Administrator can assign mailboxes."))
        }
        val res = FirebaseService.assignMailboxToAdmin(mailbox, admin.uid, admin.email)
        if (res.isSuccess) {
            // Update local memory
            val updated = _mailboxes.value.map { mb ->
                if (mb.id == mailbox.id) {
                    mb.copy(assignedAdminId = admin.uid, assignedAdminEmail = admin.email)
                } else mb
            }
            _mailboxes.value = updated
            savePersistedMailboxes(updated)
            // Re-sync
            syncWithFirebase()
        }
        return res
    }

    // SuperAdmin updates an admin's delegated permissions
    suspend fun updateAdminPermissions(
        admin: AdminUser,
        allowLicenseKeys: Boolean,
        gmails: List<String>,
        zohos: List<String>,
        imaps: List<String>
    ): Result<Boolean> {
        if (!isSuperAdmin()) {
            return Result.failure(Exception("Access Denied: Only Super Administrator can manage team permissions."))
        }
        val res = FirebaseService.updateAdminPermissions(admin.uid, allowLicenseKeys, gmails, zohos, imaps)
        if (res.isSuccess) {
            syncWithFirebase()
        }
        return res
    }

    // Export all mailboxes as JSON (matching website GmailMonitor.jsx)
    fun exportAllMailboxesAsJson(): String {
        val all = _mailboxes.value
        val array = JSONArray()
        for (mb in all) {
            val obj = JSONObject()
            obj.put("id", mb.id)
            obj.put("email", mb.email)
            obj.put("type", mb.type.name.lowercase())
            obj.put("host", mb.host)
            obj.put("port", mb.port)
            obj.put("game_id_name", mb.gameIdName ?: "")
            obj.put("game_uid", mb.gameUid ?: "")
            obj.put("assignedAdminId", mb.assignedAdminId ?: "")
            obj.put("assignedAdminEmail", mb.assignedAdminEmail ?: "")
            array.put(obj)
        }
        val wrapper = JSONObject()
        wrapper.put("exportedAt", SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date()))
        wrapper.put("totalCount", all.size)
        wrapper.put("accounts", array)
        return wrapper.toString(2)
    }

}
