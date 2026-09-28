package com.example.adminapp.ui

import android.app.Activity
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.adminapp.R
import com.example.adminapp.data.AdminRepository
import com.example.adminapp.data.FirebaseService
import com.example.adminapp.theme.*
import com.example.adminapp.ui.screens.*
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.Scope
import kotlinx.coroutines.launch

enum class AppScreen(val title: String) {
    MY_PROFILE("My Profile"),
    MAILBOXES("Mailboxes"),
    OTP_MONITOR("Garena OTP"),
    PREMIUM_DASHBOARD("Premium Dashboard"),
    LICENSES("License Keys"),
    ADMINS("Admin Management"),
    SUPPORT_CHAT("Support Chat")
}

enum class BottomBarTab(val title: String, val icon: ImageVector, val screen: AppScreen) {
    MAILBOXES("Mailbox", Icons.Default.Mail, AppScreen.MAILBOXES),
    OTP_MONITOR("Garena OTP", Icons.Default.MarkEmailRead, AppScreen.OTP_MONITOR)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminAppScaffold(
    onLogout: () -> Unit
) {
    val currentUser by AdminRepository.currentUser.collectAsState()
    val otps by AdminRepository.otpList.collectAsState()
    val mailboxes by AdminRepository.mailboxes.collectAsState()
    val licenseKeys by AdminRepository.licenseKeys.collectAsState()
    val isSyncing by AdminRepository.isSyncing.collectAsState()
    val isSuperAdmin = remember(currentUser) { AdminRepository.isSuperAdmin(currentUser) }
    val accessibleMailboxes = remember(mailboxes, currentUser) { AdminRepository.getAccessibleMailboxes() }
    val accessibleOtps = remember(otps, accessibleMailboxes, isSuperAdmin) {
        if (isSuperAdmin) otps else {
            val set = accessibleMailboxes.map { it.email.lowercase() }.toSet()
            otps.filter { set.contains(it.recipientMailbox.lowercase()) }
        }
    }

    val context = LocalContext.current
    var currentScreen by remember { mutableStateOf(AppScreen.MAILBOXES) }
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val coroutineScope = rememberCoroutineScope()
    var isLinkingGmail by remember { mutableStateOf(false) }

    // Google Sign-In OAuth client for Gmail linking
    val googleOAuthClient = remember {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestServerAuthCode(FirebaseService.WEB_CLIENT_ID, true)
            .requestEmail()
            .requestScopes(
                Scope("https://mail.google.com/"),
                Scope("https://www.googleapis.com/auth/gmail.readonly")
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
                            Toast.makeText(context, "✅ Gmail Linked: ${mb.email}", Toast.LENGTH_SHORT).show()
                        }.onFailure {
                            if (email.isNotBlank()) {
                                AdminRepository.connectGmailMailbox(email, "Gmail OAuth")
                                Toast.makeText(context, "✅ Gmail Linked: $email", Toast.LENGTH_SHORT).show()
                            }
                        }
                    } else if (email.isNotBlank()) {
                        AdminRepository.connectGmailMailbox(email, "Gmail OAuth")
                        isLinkingGmail = false
                        Toast.makeText(context, "✅ Gmail Linked: $email", Toast.LENGTH_SHORT).show()
                    } else {
                        isLinkingGmail = false
                        Toast.makeText(context, "Gmail linking cancelled", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: ApiException) {
                isLinkingGmail = false
                Toast.makeText(context, "Gmail link failed: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        } else {
            isLinkingGmail = false
        }
    }

    // Rotating sync icon animation
    val infiniteTransition = rememberInfiniteTransition(label = "syncSpin")
    val spinAngle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "spin"
    )

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = SurfaceDark,
                drawerContentColor = TextPrimary,
                modifier = Modifier
                    .width(310.dp)
                    .fillMaxHeight()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        // 1. Brand Header with App Logo
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(46.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(CardDark)
                                    .border(1.2.dp, Brush.linearGradient(listOf(IndigoAccent, CyanAccent)), RoundedCornerShape(14.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Image(
                                    painter = painterResource(id = R.drawable.app_logo),
                                    contentDescription = "App Logo",
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .clip(RoundedCornerShape(14.dp)),
                                    contentScale = ContentScale.Crop
                                )
                            }

                            Column {
                                Text(
                                    text = "ADMIN CONSOLE",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Black,
                                    color = TextPrimary,
                                    letterSpacing = 0.5.sp
                                )
                                Text(
                                    text = "Enterprise Security Portal",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = TextSecondary
                                )
                            }
                        }

                        // 2. User Profile Card (Clickable to open My Profile)
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(CardDark)
                                .border(1.dp, if (currentScreen == AppScreen.MY_PROFILE) IndigoAccent else CardBorder, RoundedCornerShape(14.dp))
                                .clickable {
                                    currentScreen = AppScreen.MY_PROFILE
                                    coroutineScope.launch { drawerState.close() }
                                }
                                .padding(12.dp)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(40.dp)
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(
                                                if (isSuperAdmin) Color(0xFF581C87).copy(alpha = 0.5f) else IndigoPrimary.copy(alpha = 0.2f)
                                            ),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = (currentUser?.displayName?.take(1) ?: currentUser?.email?.take(1) ?: "A").uppercase(),
                                            fontWeight = FontWeight.Black,
                                            fontSize = 17.sp,
                                            color = if (isSuperAdmin) AmberWarning else IndigoAccent
                                        )
                                    }

                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = currentUser?.displayName?.ifBlank { null } ?: currentUser?.email?.substringBefore('@') ?: "Admin",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimary,
                                            maxLines = 1
                                        )

                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(4.dp))
                                                .background(
                                                    if (isSuperAdmin) Color(0xFF7C3AED).copy(alpha = 0.2f) else IndigoPrimary.copy(alpha = 0.15f)
                                                )
                                                .padding(horizontal = 6.dp, vertical = 2.dp)
                                        ) {
                                            Text(
                                                text = if (isSuperAdmin) "👑 Super Admin" else "🛡️ Administrator",
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Black,
                                                color = if (isSuperAdmin) Color(0xFFC084FC) else IndigoAccent
                                            )
                                        }
                                    }
                                }

                                // Link Gmail Button
                                Button(
                                    onClick = {
                                        // Sign out first so Google account picker always appears
                                        try { googleOAuthClient.signOut() } catch (_: Exception) {}
                                        googleOAuthLauncher.launch(googleOAuthClient.signInIntent)
                                    },
                                    enabled = !isLinkingGmail,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(40.dp),
                                    shape = RoundedCornerShape(10.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = Color(0xFF1a73e8),
                                        contentColor = Color.White
                                    )
                                ) {
                                    if (isLinkingGmail) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(16.dp),
                                            color = Color.White,
                                            strokeWidth = 2.dp
                                        )
                                        Spacer(Modifier.width(8.dp))
                                        Text("Linking...", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    } else {
                                        Icon(
                                            Icons.Default.Mail,
                                            contentDescription = null,
                                            modifier = Modifier.size(15.dp)
                                        )
                                        Spacer(Modifier.width(6.dp))
                                        Text("Link Gmail Account", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }

                        HorizontalDivider(color = CardBorder)

                        // 3. Slide Bar Navigation (All Other Options + Quick Links)
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = "ADMIN TOOLS & DASHBOARD",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = TextMuted,
                                letterSpacing = 0.8.sp,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )

                            // Option 0: My Profile (Full website Profile.jsx matching)
                            DrawerNavRow(
                                icon = Icons.Default.AccountCircle,
                                title = "My Profile & Integrations",
                                badgeText = if (isSuperAdmin) "Superadmin" else "Admin",
                                isSelected = currentScreen == AppScreen.MY_PROFILE,
                                onClick = {
                                    currentScreen = AppScreen.MY_PROFILE
                                    coroutineScope.launch { drawerState.close() }
                                }
                            )

                            // Option 1: Premium Dashboard
                            DrawerNavRow(
                                icon = Icons.Default.WorkspacePremium,
                                title = "Premium Dashboard",
                                badgeText = "Clients & UIDs",
                                isSelected = currentScreen == AppScreen.PREMIUM_DASHBOARD,
                                onClick = {
                                    currentScreen = AppScreen.PREMIUM_DASHBOARD
                                    coroutineScope.launch { drawerState.close() }
                                }
                            )

                            // Option 2: License Keys
                            DrawerNavRow(
                                icon = Icons.Default.Key,
                                title = "License Keys",
                                badgeText = "${licenseKeys.size} Keys",
                                isSelected = currentScreen == AppScreen.LICENSES,
                                onClick = {
                                    currentScreen = AppScreen.LICENSES
                                    coroutineScope.launch { drawerState.close() }
                                }
                            )

                            // Option 3: Support Chat (New)
                            DrawerNavRow(
                                icon = Icons.Default.SupportAgent,
                                title = "Support Chat",
                                badgeText = "Live Clients",
                                isSelected = currentScreen == AppScreen.SUPPORT_CHAT,
                                onClick = {
                                    currentScreen = AppScreen.SUPPORT_CHAT
                                    coroutineScope.launch { drawerState.close() }
                                }
                            )

                            // Option 4: Admins (Super Admin only)
                            if (isSuperAdmin) {
                                DrawerNavRow(
                                    icon = Icons.Default.Group,
                                    title = "Admin Management",
                                    badgeText = "Team Control",
                                    isSelected = currentScreen == AppScreen.ADMINS,
                                    onClick = {
                                        currentScreen = AppScreen.ADMINS
                                        coroutineScope.launch { drawerState.close() }
                                    }
                                )
                            }

                            HorizontalDivider(color = CardBorder, modifier = Modifier.padding(vertical = 4.dp))

                            Text(
                                text = "LIVE MONITORING",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = TextMuted,
                                letterSpacing = 0.8.sp,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )

                            // Quick Link: Connected Mailboxes
                            DrawerNavRow(
                                icon = Icons.Default.Mail,
                                title = "Connected Mailboxes",
                                badgeText = "${accessibleMailboxes.size} Synced",
                                isSelected = currentScreen == AppScreen.MAILBOXES,
                                onClick = {
                                    currentScreen = AppScreen.MAILBOXES
                                    coroutineScope.launch { drawerState.close() }
                                }
                            )

                            // Quick Link: Garena OTP Monitor
                            DrawerNavRow(
                                icon = Icons.Default.MarkEmailRead,
                                title = "Garena OTP Feed",
                                badgeText = if (accessibleOtps.isNotEmpty()) "${accessibleOtps.size} Live" else null,
                                isSelected = currentScreen == AppScreen.OTP_MONITOR,
                                onClick = {
                                    currentScreen = AppScreen.OTP_MONITOR
                                    coroutineScope.launch { drawerState.close() }
                                }
                            )
                        }
                    }

                    // 4. Footer Logout Button
                    OutlinedButton(
                        onClick = onLogout,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = RoseAlert),
                        border = ButtonDefaults.outlinedButtonBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(RoseAlert.copy(alpha = 0.4f)))
                    ) {
                        Icon(Icons.Default.ExitToApp, contentDescription = "Sign Out", modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Sign Out", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }
        }
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    navigationIcon = {
                        // 3-Line Hamburger Menu Button (opens drawer)
                        IconButton(onClick = { coroutineScope.launch { drawerState.open() } }) {
                            Icon(
                                imageVector = Icons.Default.Menu,
                                contentDescription = "Open Sidebar Navigation",
                                tint = TextPrimary
                            )
                        }
                    },
                    title = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = when (currentScreen) {
                                    AppScreen.MY_PROFILE -> "MY PROFILE"
                                    AppScreen.MAILBOXES -> "CONNECTED MAILBOXES"
                                    AppScreen.OTP_MONITOR -> "GARENA OTP"
                                    AppScreen.PREMIUM_DASHBOARD -> "PREMIUM DASHBOARD"
                                    AppScreen.LICENSES -> "LICENSE KEYS"
                                    AppScreen.ADMINS -> "ADMIN TEAM"
                                    AppScreen.SUPPORT_CHAT -> "SUPPORT DESK"
                                },
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Black,
                                color = TextPrimary,
                                letterSpacing = 0.5.sp,
                                maxLines = 1
                            )

                            // Role Indicator Chip
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(
                                        if (isSuperAdmin) Color(0xFF7C3AED).copy(alpha = 0.15f) else IndigoPrimary.copy(alpha = 0.15f)
                                    )
                                    .border(
                                        1.dp,
                                        if (isSuperAdmin) Color(0xFF7C3AED).copy(alpha = 0.4f) else IndigoPrimary.copy(alpha = 0.3f),
                                        RoundedCornerShape(8.dp)
                                    )
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .clip(RoundedCornerShape(3.dp))
                                        .background(if (isSuperAdmin) AmberWarning else EmeraldSuccess)
                                )
                                Text(
                                    text = if (isSuperAdmin) "SUPER ADMIN" else "ADMIN",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (isSuperAdmin) Color(0xFFC084FC) else IndigoAccent
                                )
                            }
                        }
                    },
                    actions = {
                        // Live Sync with ff-store-4a61e website
                        IconButton(onClick = { AdminRepository.syncWithFirebase() }) {
                            Icon(
                                imageVector = Icons.Default.Sync,
                                contentDescription = "Sync with Website",
                                tint = IndigoAccent,
                                modifier = if (isSyncing) Modifier.rotate(spinAngle) else Modifier
                            )
                        }
                        IconButton(onClick = onLogout) {
                            Icon(
                                imageVector = Icons.Default.ExitToApp,
                                contentDescription = "Sign Out",
                                tint = RoseAlert
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceDark)
                )
            },
            // STRICT USER REQUIREMENT: Bottom menu ONLY has Mailbox and Garena OTP!
            bottomBar = {
                NavigationBar(
                    containerColor = SurfaceDark,
                    tonalElevation = 8.dp
                ) {
                    BottomBarTab.entries.forEach { tab ->
                        val isSelected = currentScreen == tab.screen
                        NavigationBarItem(
                            selected = isSelected,
                            onClick = { currentScreen = tab.screen },
                            icon = {
                                if (tab == BottomBarTab.OTP_MONITOR && accessibleOtps.isNotEmpty()) {
                                    BadgedBox(badge = {
                                        Badge(containerColor = EmeraldSuccess) {
                                            Text(accessibleOtps.size.toString(), color = Color.White)
                                        }
                                    }) {
                                        Icon(tab.icon, contentDescription = tab.title)
                                    }
                                } else {
                                    Icon(tab.icon, contentDescription = tab.title)
                                }
                            },
                            label = {
                                Text(
                                    text = tab.title,
                                    fontSize = 11.sp,
                                    fontWeight = if (isSelected) FontWeight.Black else FontWeight.Bold
                                )
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = IndigoPrimary,
                                selectedTextColor = IndigoAccent,
                                indicatorColor = IndigoPrimary.copy(alpha = 0.2f),
                                unselectedIconColor = TextMuted,
                                unselectedTextColor = TextMuted
                            )
                        )
                    }
                }
            }
        ) { innerPadding ->
            val securityAlerts by AdminRepository.securityAlerts.collectAsState()
            var showSecurityAuditDialog by remember { mutableStateOf(false) }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                // --- 🚨 Top Security Threat Banner (Broadcast to ALL Logged-In Admins) ---
                if (securityAlerts.isNotEmpty()) {
                    val latestAlert = securityAlerts.first()
                    val alertLockout = AdminRepository.getLockoutStatus(latestAlert.targetEmail)

                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showSecurityAuditDialog = true },
                        color = Color(0xFF2E1015),
                        border = androidx.compose.foundation.BorderStroke(1.dp, RoseAlert.copy(alpha = 0.6f))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                modifier = Modifier.weight(1f),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(Icons.Default.Security, contentDescription = null, tint = RoseAlert, modifier = Modifier.size(16.dp))
                                Text(
                                    text = if (latestAlert.isLocked || alertLockout.isLocked) {
                                        "🚨 ALERT: ${latestAlert.targetEmail} LOCKED (10 Days) - Brute-Force Trial"
                                    } else {
                                        "⚠️ SECURITY NOTICE: ${latestAlert.targetEmail} had ${latestAlert.failedAttempts}/10 failed password trials"
                                    },
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = RoseAlert,
                                    maxLines = 1,
                                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                )
                            }
                            Text(
                                text = "VIEW AUDIT ❯",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                color = Color.White
                            )
                        }
                    }
                }

                // Active App Screen
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    when (currentScreen) {
                        AppScreen.MY_PROFILE -> ProfileScreen()
                        AppScreen.MAILBOXES -> MailboxesScreen()
                        AppScreen.OTP_MONITOR -> OtpMonitorScreen()
                        AppScreen.PREMIUM_DASHBOARD -> PremiumDashboardScreen()
                        AppScreen.LICENSES -> LicenseKeysScreen()
                        AppScreen.ADMINS -> AdminsScreen()
                        AppScreen.SUPPORT_CHAT -> SupportChatScreen()
                    }
                }

                // Security Audit Details Dialog
                if (showSecurityAuditDialog) {
                    AlertDialog(
                        onDismissRequest = { showSecurityAuditDialog = false },
                        containerColor = SurfaceDark,
                        title = {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(Icons.Default.Security, contentDescription = null, tint = RoseAlert)
                                Text("Threat Trail & Audit", fontSize = 16.sp, fontWeight = FontWeight.Black, color = TextPrimary)
                            }
                        },
                        text = {
                            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text(
                                    text = "All administrators receive real-time notifications of suspicious password trials. After 10 failed attempts, accounts are locked for 10 days.",
                                    fontSize = 11.sp,
                                    color = TextSecondary
                                )
                                securityAlerts.forEach { alert ->
                                    val alertLockout = AdminRepository.getLockoutStatus(alert.targetEmail)
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(CardDark)
                                            .border(
                                                1.dp,
                                                if (alert.isLocked || alertLockout.isLocked) RoseAlert else CardBorder,
                                                RoundedCornerShape(10.dp)
                                            )
                                            .padding(10.dp),
                                        verticalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(alert.targetEmail, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = TextPrimary)
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(6.dp))
                                                    .background(
                                                        (if (alert.isLocked || alertLockout.isLocked) RoseAlert else GoldAccent).copy(alpha = 0.2f)
                                                    )
                                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                                            ) {
                                                Text(
                                                    text = if (alert.isLocked || alertLockout.isLocked) "LOCKED (10 DAYS)" else "WARNING",
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.Black,
                                                    color = if (alert.isLocked || alertLockout.isLocked) RoseAlert else GoldAccent
                                                )
                                            }
                                        }
                                        Text("Failed password attempts: ${alert.failedAttempts}/10", fontSize = 10.sp, color = TextMuted)
                                        if (alert.isLocked || alertLockout.isLocked) {
                                            Text("Lockout time remaining: ${alertLockout.remainingTimeStr}", fontSize = 10.sp, color = RoseAlert, fontWeight = FontWeight.Bold)
                                        }

                                        if (isSuperAdmin) {
                                            Button(
                                                onClick = {
                                                    AdminRepository.unlockAccount(alert.targetEmail)
                                                    showSecurityAuditDialog = false
                                                },
                                                modifier = Modifier.padding(top = 4.dp).height(32.dp),
                                                shape = RoundedCornerShape(8.dp),
                                                colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
                                            ) {
                                                Text("Unlock Account (SuperAdmin)", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        confirmButton = {
                            TextButton(onClick = { showSecurityAuditDialog = false }) {
                                Text("Close", fontWeight = FontWeight.Bold, color = IndigoAccent)
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun DrawerNavRow(
    icon: ImageVector,
    title: String,
    badgeText: String? = null,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(
                if (isSelected) IndigoPrimary else Color.Transparent
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                tint = if (isSelected) Color.White else IndigoAccent,
                modifier = Modifier.size(20.dp)
            )
            Text(
                text = title,
                fontSize = 13.sp,
                fontWeight = if (isSelected) FontWeight.Black else FontWeight.SemiBold,
                color = if (isSelected) Color.White else TextPrimary
            )
        }

        if (badgeText != null) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(
                        if (isSelected) Color.White.copy(alpha = 0.2f) else CardDark
                    )
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text(
                    text = badgeText,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isSelected) Color.White else TextSecondary
                )
            }
        }
    }
}
