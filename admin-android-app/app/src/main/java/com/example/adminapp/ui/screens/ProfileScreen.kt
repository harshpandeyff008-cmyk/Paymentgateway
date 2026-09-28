package com.example.adminapp.ui.screens

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.adminapp.data.AdminRepository
import com.example.adminapp.data.ConnectedMailbox
import com.example.adminapp.data.FirebaseService
import com.example.adminapp.data.MailboxType
import com.example.adminapp.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen() {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val currentUser by AdminRepository.currentUser.collectAsState()
    val mailboxes by AdminRepository.mailboxes.collectAsState()
    val isSuperAdmin = remember(currentUser) { AdminRepository.isSuperAdmin(currentUser) }

    // Edit Profile State
    var profileName by remember(currentUser) { mutableStateOf(currentUser?.displayName ?: "") }
    var profileMobile by remember(currentUser) { mutableStateOf(currentUser?.mobile ?: "") }
    var profileInstagram by remember(currentUser) { mutableStateOf(currentUser?.instagramId ?: "") }
    var isSavingProfile by remember { mutableStateOf(false) }

    // Password Change State
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var isUpdatingPassword by remember { mutableStateOf("") }

    // Link IMAP Modal State
    var showImapModal by remember { mutableStateOf(false) }
    var imapEmail by remember { mutableStateOf("") }
    var imapHost by remember { mutableStateOf("") }
    var imapPort by remember { mutableStateOf("993") }
    var imapUser by remember { mutableStateOf("") }
    var imapPassword by remember { mutableStateOf("") }
    var imapSecure by remember { mutableStateOf(true) }
    var selectedProvider by remember { mutableStateOf("manual") }
    var isSavingImap by remember { mutableStateOf(false) }

    // Gmail Linking State
    var isLinkingGmail by remember { mutableStateOf(false) }

    // Autocomplete host settings based on provider
    LaunchedEffect(selectedProvider) {
        when (selectedProvider) {
            "gmail" -> {
                imapHost = "imap.gmail.com"
                imapPort = "993"
                imapSecure = true
            }
            "zoho_in" -> {
                imapHost = "imap.zoho.in"
                imapPort = "993"
                imapSecure = true
            }
            "zoho_com" -> {
                imapHost = "imap.zoho.com"
                imapPort = "993"
                imapSecure = true
            }
        }
    }

    val gmailMailboxes = remember(mailboxes) { mailboxes.filter { it.type == MailboxType.GMAIL } }
    val zohoMailboxes = remember(mailboxes) { mailboxes.filter { it.type == MailboxType.ZOHO } }
    val imapMailboxes = remember(mailboxes) { mailboxes.filter { it.type == MailboxType.IMAP } }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 1. Profile Banner & Role Badge
        item {
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = CardDark),
                border = CardDefaults.outlinedCardBorder().copy(brush = Brush.linearGradient(listOf(IndigoAccent.copy(alpha = 0.5f), CyanAccent.copy(alpha = 0.3f))))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(if (isSuperAdmin) Color(0xFF581C87) else IndigoPrimary.copy(alpha = 0.3f))
                                .border(1.5.dp, if (isSuperAdmin) AmberWarning else IndigoAccent, RoundedCornerShape(16.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = (currentUser?.displayName?.take(1) ?: currentUser?.email?.take(1) ?: "A").uppercase(),
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Black,
                                color = if (isSuperAdmin) AmberWarning else IndigoAccent
                            )
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = currentUser?.displayName?.ifBlank { null } ?: currentUser?.email?.substringBefore('@') ?: "Administrator",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Black,
                                color = TextPrimary
                            )
                            Text(
                                text = currentUser?.email ?: "",
                                fontSize = 12.sp,
                                color = TextSecondary
                            )
                            Spacer(Modifier.height(4.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(if (isSuperAdmin) Color(0xFF7C3AED).copy(alpha = 0.25f) else IndigoPrimary.copy(alpha = 0.2f))
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                            ) {
                                Text(
                                    text = if (isSuperAdmin) "👑 ROOT SUPERADMIN" else "🛡️ PRIVILEGED ADMINISTRATOR",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (isSuperAdmin) Color(0xFFC084FC) else IndigoAccent
                                )
                            }
                        }
                    }

                    HorizontalDivider(color = CardBorder)

                    // Live Stats Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceAround
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Total Mailboxes", fontSize = 11.sp, color = TextMuted)
                            Text("${mailboxes.size}", fontSize = 16.sp, fontWeight = FontWeight.Black, color = TextPrimary)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Gmail Accounts", fontSize = 11.sp, color = TextMuted)
                            Text("${gmailMailboxes.size}", fontSize = 16.sp, fontWeight = FontWeight.Black, color = Color(0xFFEF4444))
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("IMAP Mailboxes", fontSize = 11.sp, color = TextMuted)
                            Text("${imapMailboxes.size}", fontSize = 16.sp, fontWeight = FontWeight.Black, color = CyanAccent)
                        }
                    }
                }
            }
        }

        // 2. Edit Profile Details Card
        item {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = CardDark),
                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(CardBorder))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.Person, contentDescription = null, tint = IndigoAccent, modifier = Modifier.size(20.dp))
                        Text("Profile Parameters", fontSize = 16.sp, fontWeight = FontWeight.Black, color = TextPrimary)
                    }

                    OutlinedTextField(
                        value = profileName,
                        onValueChange = { profileName = it },
                        label = { Text("Full Name") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            focusedBorderColor = IndigoAccent,
                            unfocusedBorderColor = CardBorder
                        )
                    )

                    OutlinedTextField(
                        value = profileMobile,
                        onValueChange = { profileMobile = it },
                        label = { Text("Mobile Number") },
                        leadingIcon = { Icon(Icons.Default.Phone, contentDescription = null, tint = TextMuted) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            focusedBorderColor = IndigoAccent,
                            unfocusedBorderColor = CardBorder
                        )
                    )

                    OutlinedTextField(
                        value = profileInstagram,
                        onValueChange = { profileInstagram = it },
                        label = { Text("Instagram Username (@username)") },
                        leadingIcon = { Text("@", color = Color(0xFFEC4899), fontWeight = FontWeight.Black, modifier = Modifier.padding(start = 12.dp)) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            focusedBorderColor = Color(0xFFEC4899),
                            unfocusedBorderColor = CardBorder
                        )
                    )

                    Button(
                        onClick = {
                            isSavingProfile = true
                            coroutineScope.launch {
                                val res = AdminRepository.updateProfileDetails(profileName, profileMobile, profileInstagram)
                                isSavingProfile = false
                                if (res.isSuccess) {
                                    Toast.makeText(context, "Profile details updated successfully!", Toast.LENGTH_SHORT).show()
                                } else {
                                    Toast.makeText(context, "Update failed: ${res.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                                }
                            }
                        },
                        enabled = !isSavingProfile,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
                    ) {
                        if (isSavingProfile) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White)
                            Spacer(Modifier.width(8.dp))
                        }
                        Text("Save Profile Changes", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }
        }

        // 3. Change Credentials / Password Card
        item {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = CardDark),
                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(CardBorder))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.Key, contentDescription = null, tint = AmberWarning, modifier = Modifier.size(20.dp))
                        Text("Change Credentials", fontSize = 16.sp, fontWeight = FontWeight.Black, color = TextPrimary)
                    }

                    OutlinedTextField(
                        value = newPassword,
                        onValueChange = { newPassword = it },
                        label = { Text("New Password (Min. 6 chars)") },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            focusedBorderColor = AmberWarning,
                            unfocusedBorderColor = CardBorder
                        )
                    )

                    OutlinedTextField(
                        value = confirmPassword,
                        onValueChange = { confirmPassword = it },
                        label = { Text("Confirm New Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            focusedBorderColor = AmberWarning,
                            unfocusedBorderColor = CardBorder
                        )
                    )

                    Button(
                        onClick = {
                            if (newPassword.length < 6) {
                                Toast.makeText(context, "Password must be at least 6 characters", Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            if (newPassword != confirmPassword) {
                                Toast.makeText(context, "Passwords do not match", Toast.LENGTH_SHORT).show()
                                return@Button
                            }
                            isUpdatingPassword = "saving"
                            coroutineScope.launch {
                                val res = AdminRepository.updatePassword(newPassword)
                                isUpdatingPassword = ""
                                if (res.isSuccess) {
                                    Toast.makeText(context, "Password changed successfully!", Toast.LENGTH_SHORT).show()
                                    newPassword = ""
                                    confirmPassword = ""
                                } else {
                                    Toast.makeText(context, "Error: ${res.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                                }
                            }
                        },
                        enabled = isUpdatingPassword.isBlank(),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD97706))
                    ) {
                        if (isUpdatingPassword.isNotBlank()) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White)
                            Spacer(Modifier.width(8.dp))
                        }
                        Text("Update Password", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }
        }

        // 4. Gmail Integrations Card (In My Profile)
        item {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = CardDark),
                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(CardBorder))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Default.Mail, contentDescription = null, tint = Color(0xFFEF4444), modifier = Modifier.size(20.dp))
                            Text("Gmail Integrations", fontSize = 16.sp, fontWeight = FontWeight.Black, color = TextPrimary)
                        }

                        Button(
                            onClick = {
                                // Open Google OAuth consent page in browser (same as website Profile.jsx)
                                val clientId = FirebaseService.WEB_CLIENT_ID
                                val redirectUri = "https://ff-store-4a61e.firebaseapp.com/oauth-callback"
                                val scopes = listOf(
                                    "https://mail.google.com/",
                                    "https://www.googleapis.com/auth/gmail.modify",
                                    "https://www.googleapis.com/auth/gmail.readonly",
                                    "https://www.googleapis.com/auth/gmail.send",
                                    "https://www.googleapis.com/auth/gmail.compose",
                                    "https://www.googleapis.com/auth/gmail.insert",
                                    "https://www.googleapis.com/auth/gmail.labels",
                                    "https://www.googleapis.com/auth/gmail.drafts.create",
                                    "https://www.googleapis.com/auth/gmail.drafts.readonly",
                                    "https://www.googleapis.com/auth/gmail.settings.basic",
                                    "https://www.googleapis.com/auth/gmail.settings.sharing",
                                    "https://www.googleapis.com/auth/gmail.addons.current.action.compose",
                                    "https://www.googleapis.com/auth/gmail.addons.current.message.action",
                                    "https://www.googleapis.com/auth/gmail.addons.current.message.readonly"
                                ).joinToString(" ")
                                val oauthUrl = "https://accounts.google.com/o/oauth2/v2/auth?" +
                                    "client_id=$clientId" +
                                    "&redirect_uri=" + java.net.URLEncoder.encode(redirectUri, "UTF-8") +
                                    "&response_type=code" +
                                    "&scope=" + java.net.URLEncoder.encode(scopes, "UTF-8") +
                                    "&access_type=offline" +
                                    "&prompt=consent"
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(oauthUrl))
                                context.startActivity(intent)
                            },
                            enabled = !isLinkingGmail,
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A73E8)),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            if (isLinkingGmail) {
                                CircularProgressIndicator(modifier = Modifier.size(14.dp), color = Color.White)
                            } else {
                                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(14.dp))
                                Spacer(Modifier.width(4.dp))
                                Text("Link New Gmail", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    if (gmailMailboxes.isEmpty()) {
                        Text(
                            text = "No Gmail accounts connected yet. Link your Gmail to enable real-time Garena OTP stream monitoring.",
                            fontSize = 12.sp,
                            color = TextMuted
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            gmailMailboxes.forEach { mb ->
                                MailboxProfileRow(
                                    mailbox = mb,
                                    isSuperAdmin = isSuperAdmin,
                                    onDisconnect = {
                                        coroutineScope.launch {
                                            val res = AdminRepository.disconnectMailbox(mb)
                                            if (res.isSuccess) {
                                                Toast.makeText(context, "Disconnected ${mb.email}", Toast.LENGTH_SHORT).show()
                                            } else {
                                                Toast.makeText(context, res.exceptionOrNull()?.message ?: "Disconnect failed", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }

        // 4B. Zoho Mail Integrations Card (Matches Website Profile.jsx:L646-716)
        item {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = CardDark),
                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(CardBorder))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Default.Email, contentDescription = null, tint = Color(0xFFC084FC), modifier = Modifier.size(20.dp))
                            Text("Zoho Mail Integrations", fontSize = 16.sp, fontWeight = FontWeight.Black, color = TextPrimary)
                        }

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFF581C87).copy(alpha = 0.25f))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text("Zoho OAuth/IMAP", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFFC084FC))
                        }
                    }

                    
                    // Zoho OAuth Link Button (matches website behavior)
                    Button(
                        onClick = {
                            val zohoClientId = "1000.FZJ97A4AV5S97D1KBMEAZ69CUDZCPH"
                            val redirectUri = "https://ff-store-4a61e.firebaseapp.com/zoho-callback"
                            val scopes = "ZohoMail.messages.READ,ZohoMail.accounts.READ,ZohoMail.folders.READ"
                            val zohoOAuthUrl = "https://accounts.zoho.in/oauth/v2/auth?" +
                                "scope=$scopes" +
                                "&client_id=$zohoClientId" +
                                "&response_type=code" +
                                "&access_type=offline" +
                                "&prompt=consent" +
                                "&redirect_uri=" + java.net.URLEncoder.encode(redirectUri, "UTF-8")
                            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(zohoOAuthUrl))
                            context.startActivity(intent)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF581C87)),
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, tint = Color(0xFFC084FC), modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Link New Zoho", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFC084FC))
                    }

if (zohoMailboxes.isEmpty()) {
                        Text(
                            text = "No Zoho Mail accounts connected. Connect your Zoho Mail accounts via IMAP or web console to audit account metrics.",
                            fontSize = 12.sp,
                            color = TextMuted
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            zohoMailboxes.forEach { mb ->
                                MailboxProfileRow(
                                    mailbox = mb,
                                    isSuperAdmin = isSuperAdmin,
                                    onDisconnect = {
                                        coroutineScope.launch {
                                            val res = AdminRepository.disconnectMailbox(mb)
                                            if (res.isSuccess) {
                                                Toast.makeText(context, "Disconnected ${mb.email}", Toast.LENGTH_SHORT).show()
                                            } else {
                                                Toast.makeText(context, res.exceptionOrNull()?.message ?: "Disconnect failed", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }

        // 5. IMAP Mailbox Integrations Card (In My Profile)
        item {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = CardDark),
                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(CardBorder))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Default.Dns, contentDescription = null, tint = CyanAccent, modifier = Modifier.size(20.dp))
                            Text("IMAP Mailbox Integrations", fontSize = 16.sp, fontWeight = FontWeight.Black, color = TextPrimary)
                        }

                        Button(
                            onClick = { showImapModal = true },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F766E)),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Link IMAP", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    if (imapMailboxes.isEmpty()) {
                        Text(
                            text = "No custom IMAP mailboxes connected. Connect your host accounts (GoDaddy, Hostinger, Zoho) to monitor verification tokens.",
                            fontSize = 12.sp,
                            color = TextMuted
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            imapMailboxes.forEach { mb ->
                                MailboxProfileRow(
                                    mailbox = mb,
                                    isSuperAdmin = isSuperAdmin,
                                    onDisconnect = {
                                        coroutineScope.launch {
                                            val res = AdminRepository.disconnectMailbox(mb)
                                            if (res.isSuccess) {
                                                Toast.makeText(context, "Disconnected ${mb.email}", Toast.LENGTH_SHORT).show()
                                            } else {
                                                Toast.makeText(context, res.exceptionOrNull()?.message ?: "Disconnect failed", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }

        // 6. Assigned Mailboxes & Permission Powers Card
        item {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = CardDark),
                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(CardBorder))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.Shield, contentDescription = null, tint = if (isSuperAdmin) AmberWarning else IndigoAccent)
                        Text("Assigned Mailbox Authority", fontSize = 16.sp, fontWeight = FontWeight.Black, color = TextPrimary)
                    }

                    if (isSuperAdmin) {
                        Text(
                            text = "👑 Root Superadmin Access: You hold full authority over all ${mailboxes.size} platform mailboxes, license keys, threat audits, and team assignments.",
                            fontSize = 12.sp,
                            color = Color(0xFFC084FC),
                            lineHeight = 18.sp
                        )
                    } else {
                        val accessible = remember(mailboxes, currentUser) { AdminRepository.getAccessibleMailboxes() }
                        Text(
                            text = "Superadmin has delegated access to ${accessible.size} mailboxes for your account. You can only view and receive OTP alerts for assigned items:",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            lineHeight = 18.sp
                        )

                        if (accessible.isEmpty()) {
                            Text(
                                text = "⚠️ No mailboxes currently assigned to your account. Contact Root Superadmin (hapa1929@gmail.com) to assign mailbox permissions.",
                                fontSize = 11.sp,
                                color = AmberWarning
                            )
                        } else {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                accessible.forEach { mb ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(SurfaceDark)
                                            .padding(horizontal = 10.dp, vertical = 6.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(mb.email, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                        Text(mb.type.name, fontSize = 10.sp, color = IndigoAccent, fontWeight = FontWeight.Black)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 7. Auto-Consent & Legal Compliance Card (Matching website Profile.jsx)
        item {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = CardDark),
                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(CardBorder))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.VerifiedUser, contentDescription = null, tint = EmeraldSuccess)
                        Text("Auto-Consent & Legal Compliance", fontSize = 16.sp, fontWeight = FontWeight.Black, color = TextPrimary)
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Consent Verification", fontSize = 12.sp, color = TextSecondary)
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(EmeraldSuccess.copy(alpha = 0.2f))
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        ) {
                            Text("ACTIVE & SIGNED", fontSize = 10.sp, fontWeight = FontWeight.Black, color = EmeraldSuccess)
                        }
                    }

                    Text(
                        text = "Authorized for automated mailbox stream monitoring, escrow verification, and credential handover under Indian IT Rules 2021.",
                        fontSize = 11.sp,
                        color = TextMuted,
                        lineHeight = 16.sp
                    )
                }
            }
        }
    }

    // --- Link IMAP Mailbox Dialog Modal ---
    if (showImapModal) {
        AlertDialog(
            onDismissRequest = { showImapModal = false },
            containerColor = SurfaceDark,
            title = {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.Dns, contentDescription = null, tint = CyanAccent)
                    Text("Link Custom IMAP Mailbox", fontSize = 17.sp, fontWeight = FontWeight.Black, color = TextPrimary)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Select Provider Preset", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextMuted)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        FilterChip(
                            selected = selectedProvider == "gmail",
                            onClick = { selectedProvider = "gmail" },
                            label = { Text("Gmail", fontSize = 10.sp) }
                        )
                        FilterChip(
                            selected = selectedProvider == "zoho_in",
                            onClick = { selectedProvider = "zoho_in" },
                            label = { Text("Zoho IN", fontSize = 10.sp) }
                        )
                        FilterChip(
                            selected = selectedProvider == "manual",
                            onClick = { selectedProvider = "manual" },
                            label = { Text("Custom", fontSize = 10.sp) }
                        )
                    }

                    OutlinedTextField(
                        value = imapEmail,
                        onValueChange = {
                            imapEmail = it
                            if (imapUser.isBlank()) imapUser = it
                        },
                        label = { Text("Email Address") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = imapHost,
                            onValueChange = { imapHost = it },
                            label = { Text("Host") },
                            singleLine = true,
                            modifier = Modifier.weight(0.7f)
                        )
                        OutlinedTextField(
                            value = imapPort,
                            onValueChange = { imapPort = it },
                            label = { Text("Port") },
                            singleLine = true,
                            modifier = Modifier.weight(0.3f)
                        )
                    }

                    OutlinedTextField(
                        value = imapUser,
                        onValueChange = { imapUser = it },
                        label = { Text("IMAP Username") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = imapPassword,
                        onValueChange = { imapPassword = it },
                        label = { Text("App Password / Access Key") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Checkbox(
                            checked = imapSecure,
                            onCheckedChange = { imapSecure = it },
                            colors = CheckboxDefaults.colors(checkedColor = CyanAccent)
                        )
                        Text("Require SSL/TLS (Port 993)", fontSize = 12.sp, color = TextPrimary)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (imapEmail.isBlank() || imapHost.isBlank() || imapPassword.isBlank()) {
                            Toast.makeText(context, "Please fill in all required fields", Toast.LENGTH_SHORT).show()
                            return@Button
                        }
                        isSavingImap = true
                        coroutineScope.launch {
                            val portNum = imapPort.toIntOrNull() ?: 993
                            val res = AdminRepository.addCustomImapMailbox(imapEmail, imapHost, portNum, imapUser, imapPassword, imapSecure)
                            isSavingImap = false
                            if (res.isSuccess) {
                                Toast.makeText(context, "IMAP Mailbox ($imapEmail) linked successfully!", Toast.LENGTH_LONG).show()
                                showImapModal = false
                                imapEmail = ""
                                imapHost = ""
                                imapPassword = ""
                                imapUser = ""
                            } else {
                                Toast.makeText(context, "Save failed: ${res.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                            }
                        }
                    },
                    enabled = !isSavingImap,
                    colors = ButtonDefaults.buttonColors(containerColor = CyanAccent)
                ) {
                    if (isSavingImap) {
                        CircularProgressIndicator(modifier = Modifier.size(14.dp), color = BackgroundDark)
                        Spacer(Modifier.width(6.dp))
                    }
                    Text("Test & Save", color = BackgroundDark, fontWeight = FontWeight.Black)
                }
            },
            dismissButton = {
                TextButton(onClick = { showImapModal = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }
}

@Composable
fun MailboxProfileRow(
    mailbox: ConnectedMailbox,
    isSuperAdmin: Boolean,
    onDisconnect: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceDark)
            .border(1.dp, CardBorder, RoundedCornerShape(12.dp))
            .padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = mailbox.email,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
                maxLines = 1
            )
            Text(
                text = "Host: ${mailbox.host}:${mailbox.port} • ${mailbox.type.name}",
                fontSize = 10.sp,
                color = TextMuted
            )
        }

        if (isSuperAdmin) {
            IconButton(
                onClick = onDisconnect,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = "Disconnect Mailbox",
                    tint = RoseAlert.copy(alpha = 0.8f),
                    modifier = Modifier.size(18.dp)
                )
            }
        } else {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color.Gray.copy(alpha = 0.15f))
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text("Protected", fontSize = 9.sp, color = TextMuted, fontWeight = FontWeight.Bold)
            }
        }
    }
}
