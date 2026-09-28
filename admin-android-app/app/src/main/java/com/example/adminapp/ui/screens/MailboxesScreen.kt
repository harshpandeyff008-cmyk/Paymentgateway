package com.example.adminapp.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context

import android.app.Activity
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.adminapp.data.AdminRepository
import com.example.adminapp.data.ConnectedMailbox
import com.example.adminapp.data.FirebaseService
import com.example.adminapp.data.MailboxType
import com.example.adminapp.theme.*
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope
import kotlinx.coroutines.launch

@Composable
fun MailboxesScreen() {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val mailboxes by AdminRepository.mailboxes.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var showImapDialog by remember { mutableStateOf(false) }
    var showGmailDialog by remember { mutableStateOf(false) }
    var isLinkingGmail by remember { mutableStateOf(false) }
    var mailboxToAssign by remember { mutableStateOf<ConnectedMailbox?>(null) }
    val admins by AdminRepository.authorizedAdmins.collectAsState()

    // Google Sign-In with Gmail Scopes & Offline Server Auth Code
    val googleOAuthClient = remember {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestServerAuthCode(FirebaseService.WEB_CLIENT_ID, true)
            .requestEmail()
            .requestScopes(
                Scope("https://mail.google.com/"),
                Scope("https://www.googleapis.com/auth/gmail.readonly"),
                Scope("https://www.googleapis.com/auth/gmail.modify")
            )
            .build()
        GoogleSignIn.getClient(context, gso)
    }

    val googleOAuthLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
            try {
                val account = task.getResult(ApiException::class.java)
                val serverAuthCode = account?.serverAuthCode
                val email = account?.email ?: ""

                isLinkingGmail = true
                coroutineScope.launch {
                    if (!serverAuthCode.isNullOrBlank()) {
                        val linkResult = AdminRepository.linkGmailWithOAuthCode(serverAuthCode)
                        isLinkingGmail = false
                        linkResult.onSuccess { mb ->
                            Toast.makeText(context, "Google Cloud OAuth Linked: ${mb.email}", Toast.LENGTH_SHORT).show()
                            showGmailDialog = false
                        }.onFailure { ex ->
                            // Fallback: Link with email directly
                            AdminRepository.connectGmailMailbox(email, "Google Cloud Authorized")
                            Toast.makeText(context, "Linked Gmail: $email", Toast.LENGTH_SHORT).show()
                            showGmailDialog = false
                        }
                    } else if (email.isNotBlank()) {
                        AdminRepository.connectGmailMailbox(email, "Google Cloud Authorized")
                        isLinkingGmail = false
                        Toast.makeText(context, "Linked Gmail: $email", Toast.LENGTH_SHORT).show()
                        showGmailDialog = false
                    }
                }
            } catch (e: ApiException) {
                isLinkingGmail = false
                Toast.makeText(context, "Google OAuth (${e.statusCode}): ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    val selectedMailboxForInbox by AdminRepository.selectedMailboxForInbox.collectAsState()
    if (selectedMailboxForInbox != null) {
        MailboxInboxSheet(
            mailbox = selectedMailboxForInbox!!,
            onClose = { AdminRepository.closeMailboxInbox() }
        )
        return
    }

    val accessibleMailboxes = remember(mailboxes) { AdminRepository.getAccessibleMailboxes() }
    val filteredMailboxes = remember(accessibleMailboxes, searchQuery) {
        if (searchQuery.isBlank()) {
            accessibleMailboxes
        } else {
            val q = searchQuery.trim().lowercase()
            accessibleMailboxes.filter {
                it.email.lowercase().contains(q) ||
                (it.gameIdName?.lowercase()?.contains(q) == true) ||
                (it.gameUid?.lowercase()?.contains(q) == true) ||
                it.type.name.lowercase().contains(q)
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Header Controls
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            val isSuperAdmin = remember { AdminRepository.isSuperAdmin() }
            Column {
                Text(
                    text = if (isSuperAdmin) "Connected Mailboxes (${accessibleMailboxes.size})" else "Assigned Mailboxes (${accessibleMailboxes.size})",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black,
                    color = TextPrimary
                )
                Text(
                    text = if (isSuperAdmin) "Full SuperAdmin Access • All Mailboxes Synced" else "Restricted Admin View • Only Authorized Mailboxes",
                    fontSize = 12.sp,
                    color = if (isSuperAdmin) CyanAccent else AmberWarning
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                if (isSuperAdmin) {
                    IconButton(onClick = {
                        val json = AdminRepository.exportAllMailboxesAsJson()
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        clipboard.setPrimaryClip(ClipData.newPlainText("Mailbox Accounts Export", json))
                        Toast.makeText(context, "Exported ${mailboxes.size} accounts JSON to clipboard!", Toast.LENGTH_LONG).show()
                    }) {
                        Icon(Icons.Default.FileDownload, contentDescription = "Export Accounts JSON", tint = IndigoAccent)
                    }
                }
                IconButton(onClick = {
                    AdminRepository.syncWithFirebase()
                    Toast.makeText(context, "Synchronizing all mailboxes from website...", Toast.LENGTH_SHORT).show()
                }) {
                    Icon(Icons.Default.Refresh, contentDescription = "Sync", tint = CyanAccent)
                }
            }
        }

        // Search Input Field
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search by email, Game ID, or account type...", fontSize = 12.sp, color = TextMuted) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp)) },
            trailingIcon = {
                if (searchQuery.isNotBlank()) {
                    IconButton(onClick = { searchQuery = "" }) {
                        Icon(Icons.Default.Close, contentDescription = "Clear", tint = TextMuted, modifier = Modifier.size(16.dp))
                    }
                }
            },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = IndigoPrimary,
                unfocusedBorderColor = CardBorder,
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary,
                cursorColor = IndigoPrimary
            )
        )

        // Action Buttons: Link Gmail & Link IMAP
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Button(
                onClick = { showGmailDialog = true },
                modifier = Modifier.weight(1f).height(46.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
            ) {
                Icon(Icons.Default.Mail, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Link Gmail (OAuth)", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }

            OutlinedButton(
                onClick = { showImapDialog = true },
                modifier = Modifier.weight(1f).height(46.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary),
                border = ButtonDefaults.outlinedButtonBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(CardBorder))
            ) {
                Icon(Icons.Default.Settings, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Link IMAP", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }

        // List of Mailboxes (STRICT RULE: NO UNLINK / DELETE BUTTON ALLOWED)
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(filteredMailboxes, key = { it.id }) { mailbox ->
                MailboxCard(
                    mailbox = mailbox,
                    onClick = { AdminRepository.openMailboxInbox(mailbox) }
                )
            }
        }
    }

    // Google Cloud Console OAuth 2.0 Linking Dialog
    if (showGmailDialog) {
        var manualCodeOrEmail by remember { mutableStateOf("") }
        var isManualMode by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { showGmailDialog = false },
            containerColor = SurfaceDark,
            title = {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(IndigoPrimary),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Security, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    }
                    Text("Google Cloud Console OAuth", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = "Connect Gmail using Google Cloud Console OAuth 2.0 (Client ID: 62657909282...) with full Gmail read & monitoring permissions. Synced live with ff-store-4a61e website.",
                        fontSize = 12.sp,
                        color = TextSecondary,
                        lineHeight = 16.sp
                    )

                    // 1. One-Tap Google Cloud Consent Flow
                    Button(
                        onClick = {
                            googleOAuthClient.signOut().addOnCompleteListener {
                                googleOAuthLauncher.launch(googleOAuthClient.signInIntent)
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color.White),
                        enabled = !isLinkingGmail
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "G",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Black,
                                color = Color(0xFF4285F4),
                                fontFamily = FontFamily.SansSerif
                            )
                            Text(
                                text = if (isLinkingGmail) "Authorizing with Google..." else "Authorize with Google Account",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF1E293B)
                            )
                        }
                    }

                    // 2. Open Official Google OAuth in Chrome Custom Tab
                    OutlinedButton(
                        onClick = {
                            val scopes = listOf(
                                "https://mail.google.com/",
                                "https://www.googleapis.com/auth/gmail.readonly",
                                "https://www.googleapis.com/auth/gmail.modify"
                            ).joinToString(" ")

                            val oauthUrl = "https://accounts.google.com/o/oauth2/v2/auth?" +
                                    "client_id=${FirebaseService.WEB_CLIENT_ID}" +
                                    "&redirect_uri=${Uri.encode(FirebaseService.OAUTH_REDIRECT_URI)}" +
                                    "&response_type=code" +
                                    "&scope=${Uri.encode(scopes)}" +
                                    "&access_type=offline" +
                                    "&prompt=consent"

                            val customTabsIntent = CustomTabsIntent.Builder().build()
                            customTabsIntent.launchUrl(context, Uri.parse(oauthUrl))
                            isManualMode = true
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = IndigoAccent),
                        border = ButtonDefaults.outlinedButtonBorder().copy(brush = Brush.horizontalGradient(listOf(IndigoPrimary, CyanAccent)))
                    ) {
                        Icon(Icons.Default.OpenInBrowser, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Open Browser OAuth Consent Page", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    // 3. Manual Paste Auth Code or Email
                    if (isManualMode) {
                        OutlinedTextField(
                            value = manualCodeOrEmail,
                            onValueChange = { manualCodeOrEmail = it },
                            label = { Text("Paste Auth Code or Gmail Address", fontSize = 11.sp) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary
                            )
                        )
                    } else {
                        TextButton(
                            onClick = { isManualMode = true },
                            modifier = Modifier.align(Alignment.CenterHorizontally)
                        ) {
                            Text("Have authorization code or Gmail address? Click here", fontSize = 11.sp, color = TextMuted)
                        }
                    }
                }
            },
            confirmButton = {
                if (isManualMode && manualCodeOrEmail.isNotBlank()) {
                    Button(
                        onClick = {
                            val input = manualCodeOrEmail.trim()
                            if (input.contains('@')) {
                                AdminRepository.connectGmailMailbox(input, "Google Cloud Manual")
                                Toast.makeText(context, "Linked Gmail: $input", Toast.LENGTH_SHORT).show()
                                showGmailDialog = false
                            } else {
                                isLinkingGmail = true
                                coroutineScope.launch {
                                    val res = AdminRepository.linkGmailWithOAuthCode(input)
                                    isLinkingGmail = false
                                    res.onSuccess { mb ->
                                        Toast.makeText(context, "OAuth Linked: ${mb.email}", Toast.LENGTH_SHORT).show()
                                        showGmailDialog = false
                                    }.onFailure { ex ->
                                        Toast.makeText(context, "OAuth Error: ${ex.message}", Toast.LENGTH_LONG).show()
                                    }
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
                    ) {
                        Text("Submit & Link")
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { showGmailDialog = false }) {
                    Text("Close", color = TextSecondary)
                }
            }
        )
    }

    // Superadmin Assign Mailbox Dialog (Matches Website Inventory.jsx:L1022-1050)
    if (mailboxToAssign != null) {
        val targetMb = mailboxToAssign!!
        AlertDialog(
            onDismissRequest = { mailboxToAssign = null },
            containerColor = SurfaceDark,
            title = {
                Column {
                    Text("Assign Mailbox Operator", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text(targetMb.email, color = CyanAccent, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Select an administrator to delegate access to this mailbox:", fontSize = 11.sp, color = TextSecondary)
                    if (admins.isEmpty()) {
                        Text("No administrators found in whitelist.", fontSize = 12.sp, color = AmberWarning)
                    } else {
                        LazyColumn(modifier = Modifier.heightIn(max = 240.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            items(admins) { admin ->
                                val isCurrentlyAssigned = targetMb.assignedAdminId == admin.uid || targetMb.assignedAdminEmail?.equals(admin.email, ignoreCase = true) == true
                                Card(
                                    shape = RoundedCornerShape(10.dp),
                                    colors = CardDefaults.cardColors(containerColor = if (isCurrentlyAssigned) IndigoPrimary.copy(alpha = 0.25f) else CardDark),
                                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(if (isCurrentlyAssigned) IndigoAccent else CardBorder)),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            coroutineScope.launch {
                                                val res = AdminRepository.assignMailboxToAdmin(targetMb, admin)
                                                if (res.isSuccess) {
                                                    Toast.makeText(context, "Assigned ${targetMb.email} to ${admin.displayName.ifBlank { admin.email }}", Toast.LENGTH_SHORT).show()
                                                } else {
                                                    Toast.makeText(context, "Failed: ${res.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                                                }
                                                mailboxToAssign = null
                                            }
                                        }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(10.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(admin.displayName.ifBlank { admin.email.substringBefore('@') }, fontWeight = FontWeight.Bold, color = TextPrimary, fontSize = 13.sp)
                                            Text(admin.email, fontSize = 11.sp, color = TextSecondary)
                                        }
                                        if (isCurrentlyAssigned) {
                                            Text("ASSIGNED", fontSize = 10.sp, fontWeight = FontWeight.Black, color = EmeraldSuccess)
                                        } else {
                                            Icon(Icons.Default.AddCircleOutline, contentDescription = null, tint = CyanAccent, modifier = Modifier.size(18.dp))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { mailboxToAssign = null }) {
                    Text("Close", color = TextSecondary)
                }
            }
        )
    }

    // Connect IMAP Dialog
    if (showImapDialog) {
        var imapEmail by remember { mutableStateOf("") }
        var imapHost by remember { mutableStateOf("imap.gmail.com") }
        var imapPort by remember { mutableStateOf("993") }
        var imapPassword by remember { mutableStateOf("") }
        var gameIdName by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { showImapDialog = false },
            containerColor = SurfaceDark,
            title = {
                Text("Link IMAP Mailbox", color = TextPrimary, fontWeight = FontWeight.Bold)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = imapEmail,
                        onValueChange = { imapEmail = it },
                        label = { Text("Email Address") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )
                    OutlinedTextField(
                        value = gameIdName,
                        onValueChange = { gameIdName = it },
                        label = { Text("Game Account Label (e.g. 500 prime id)") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )
                    OutlinedTextField(
                        value = imapHost,
                        onValueChange = { imapHost = it },
                        label = { Text("IMAP Server Host") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )
                    OutlinedTextField(
                        value = imapPort,
                        onValueChange = { imapPort = it },
                        label = { Text("Port (SSL)") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )
                    OutlinedTextField(
                        value = imapPassword,
                        onValueChange = { imapPassword = it },
                        label = { Text("App Password") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (imapEmail.isNotBlank()) {
                            AdminRepository.connectImapMailbox(imapEmail, imapHost, imapPort.toIntOrNull() ?: 993, gameIdName.ifBlank { null })
                            showImapDialog = false
                            Toast.makeText(context, "Connected IMAP: $imapEmail", Toast.LENGTH_SHORT).show()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
                ) {
                    Text("Connect IMAP")
                }
            },
            dismissButton = {
                TextButton(onClick = { showImapDialog = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }
}

@Composable
fun MailboxCard(
    mailbox: ConnectedMailbox,
    isSuperAdmin: Boolean = false,
    onAssignClick: () -> Unit = {},
    onClick: () -> Unit
) {
    val typeBadgeColor = when (mailbox.type) {
        MailboxType.GMAIL -> IndigoAccent
        MailboxType.ZOHO -> Color(0xFFC084FC) // Violet
        MailboxType.IMAP -> AmberWarning
    }
    val typeBgColor = when (mailbox.type) {
        MailboxType.GMAIL -> IndigoPrimary.copy(alpha = 0.15f)
        MailboxType.ZOHO -> Color(0xFF9333EA).copy(alpha = 0.15f)
        MailboxType.IMAP -> AmberWarning.copy(alpha = 0.15f)
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(CardDark)
            .border(1.dp, CardBorder, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(typeBgColor),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = when (mailbox.type) {
                        MailboxType.GMAIL -> Icons.Default.Mail
                        MailboxType.ZOHO -> Icons.Default.Email
                        MailboxType.IMAP -> Icons.Default.Settings
                    },
                    contentDescription = null,
                    tint = typeBadgeColor,
                    modifier = Modifier.size(22.dp)
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = mailbox.email,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )

                if (!mailbox.gameIdName.isNullOrBlank() || !mailbox.gameUid.isNullOrBlank()) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (!mailbox.gameIdName.isNullOrBlank()) {
                            Text(
                                text = "🎮 ${mailbox.gameIdName}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = CyanAccent
                            )
                        }
                        if (!mailbox.gameUid.isNullOrBlank()) {
                            Text(
                                text = "UID: ${mailbox.gameUid}",
                                fontSize = 10.sp,
                                color = TextMuted
                            )
                        }
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(EmeraldSuccess)
                    )
                    Text(
                        text = "${mailbox.type.name} • ${mailbox.host} (${mailbox.port})",
                        fontSize = 11.sp,
                        color = TextSecondary
                    )
                }

                if (!mailbox.assignedAdminEmail.isNullOrBlank()) {
                    Text(
                        text = "👤 Assigned: ${mailbox.assignedAdminEmail.substringBefore('@')}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFFC084FC)
                    )
                }
            }
        }

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            if (isSuperAdmin) {
                OutlinedButton(
                    onClick = onAssignClick,
                    modifier = Modifier.height(28.dp),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                    shape = RoundedCornerShape(6.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = CyanAccent)
                ) {
                    Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(12.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Assign", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
            IconButton(onClick = onClick) {
                Icon(Icons.Default.ChevronRight, contentDescription = "Open Mailbox Inbox", tint = IndigoAccent, modifier = Modifier.size(24.dp))
            }
        }
    }
}
