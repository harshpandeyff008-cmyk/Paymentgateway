package com.example.adminapp.ui.screens

import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.adminapp.R
import com.example.adminapp.data.AdminRepository
import com.example.adminapp.theme.*
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    
    // Clean empty starting states (No prefilled rootadmin / shivambhatt)
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }

    val securityAlerts by AdminRepository.securityAlerts.collectAsState()
    val cleanEmail = email.trim().lowercase()
    val emailLockoutStatus = remember(cleanEmail, securityAlerts) {
        AdminRepository.getLockoutStatus(cleanEmail)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF070B14),
                        Color(0xFF0F172A),
                        Color(0xFF050811)
                    )
                )
            )
            .padding(20.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(28.dp))
                .background(SurfaceDark.copy(alpha = 0.95f))
                .border(1.2.dp, CardBorder, RoundedCornerShape(28.dp))
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // --- Premium Cybernetic App Logo ---
            Box(
                modifier = Modifier
                    .size(76.dp)
                    .clip(RoundedCornerShape(22.dp))
                    .background(CardDark)
                    .border(1.5.dp, Brush.linearGradient(listOf(IndigoAccent, CyanAccent)), RoundedCornerShape(22.dp)),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = R.drawable.app_logo),
                    contentDescription = "App Logo",
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(22.dp)),
                    contentScale = ContentScale.Crop
                )
            }

            // Header Title
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "ADMIN CONSOLE",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black,
                    color = TextPrimary,
                    letterSpacing = 1.2.sp
                )
                Text(
                    text = "Enterprise Security & Control Portal",
                    fontSize = 12.sp,
                    color = TextSecondary,
                    textAlign = TextAlign.Center
                )
            }

            // --- 🚨 LIVE SECURITY WARNING BANNER (Broadcast to all admins) ---
            if (securityAlerts.isNotEmpty()) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    color = Color(0xFF281116),
                    border = androidx.compose.foundation.BorderStroke(1.dp, RoseAlert.copy(alpha = 0.7f))
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Default.Security, contentDescription = null, tint = RoseAlert, modifier = Modifier.size(18.dp))
                            Text(
                                text = "SECURITY ALERT: ATTACK DETECTED",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black,
                                color = RoseAlert,
                                letterSpacing = 0.5.sp
                            )
                        }
                        Text(
                            text = "Multiple failed password attempts detected across admin accounts. Threat protection active.",
                            fontSize = 10.sp,
                            color = Color.White.copy(alpha = 0.85f),
                            lineHeight = 14.sp
                        )
                        securityAlerts.take(2).forEach { alert ->
                            val alertLockout = AdminRepository.getLockoutStatus(alert.targetEmail)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color.Black.copy(alpha = 0.45f))
                                    .padding(horizontal = 8.dp, vertical = 6.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(alert.targetEmail, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                    Text(
                                        text = if (alert.isLocked || alertLockout.isLocked) "🔒 Locked for 10 Days (${alertLockout.remainingTimeStr} left)" else "⚠️ ${alert.failedAttempts}/10 failed trials",
                                        fontSize = 10.sp,
                                        color = if (alert.isLocked || alertLockout.isLocked) RoseAlert else GoldAccent
                                    )
                                }
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background((if (alert.isLocked || alertLockout.isLocked) RoseAlert else GoldAccent).copy(alpha = 0.2f))
                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = if (alert.isLocked || alertLockout.isLocked) "LOCKED" else "WARNING",
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Black,
                                        color = if (alert.isLocked || alertLockout.isLocked) RoseAlert else GoldAccent
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Error Display if any
            errorMessage?.let { error ->
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    color = RoseAlert.copy(alpha = 0.15f),
                    border = androidx.compose.foundation.BorderStroke(1.dp, RoseAlert.copy(alpha = 0.5f))
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = RoseAlert, modifier = Modifier.size(18.dp))
                        Text(text = error, fontSize = 11.sp, color = RoseAlert, fontWeight = FontWeight.SemiBold, lineHeight = 15.sp)
                    }
                }
            }

            // Email Field
            Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                OutlinedTextField(
                    value = email,
                    onValueChange = { 
                        email = it
                        errorMessage = null 
                    },
                    placeholder = { Text("Enter admin email address...", color = TextMuted, fontSize = 13.sp) },
                    label = { Text("Admin Email", color = TextSecondary, fontSize = 12.sp) },
                    leadingIcon = { Icon(Icons.Default.Email, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = if (emailLockoutStatus.isLocked) RoseAlert else IndigoPrimary,
                        unfocusedBorderColor = if (emailLockoutStatus.isLocked) RoseAlert.copy(alpha = 0.6f) else CardBorder,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        cursorColor = IndigoPrimary
                    ),
                    shape = RoundedCornerShape(14.dp)
                )

                // Lockout / Attempt Indicator below email
                if (emailLockoutStatus.isLocked) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(RoseAlert.copy(alpha = 0.15f))
                            .border(1.dp, RoseAlert.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                            .padding(horizontal = 8.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(Icons.Default.Lock, contentDescription = null, tint = RoseAlert, modifier = Modifier.size(14.dp))
                        Text(
                            text = "🔒 LOCKED FOR 10 DAYS: Next try in ${emailLockoutStatus.remainingTimeStr}. Brute-force lockout active.",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = RoseAlert
                        )
                    }
                } else if (emailLockoutStatus.failedAttempts > 0) {
                    Text(
                        text = "⚠️ ${emailLockoutStatus.failedAttempts}/10 failed attempts recorded. Account locks for 10 days at 10.",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = GoldAccent,
                        modifier = Modifier.padding(start = 4.dp)
                    )
                }
            }

            // Password Field with Show/Hide toggle
            OutlinedTextField(
                value = password,
                onValueChange = { 
                    password = it
                    errorMessage = null 
                },
                placeholder = { Text("Enter account password...", color = TextMuted, fontSize = 13.sp) },
                label = { Text("Password", color = TextSecondary, fontSize = 12.sp) },
                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp)) },
                trailingIcon = {
                    IconButton(onClick = { showPassword = !showPassword }) {
                        Icon(
                            imageVector = if (showPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = if (showPassword) "Hide password" else "Show password",
                            tint = TextMuted,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                },
                visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = IndigoPrimary,
                    unfocusedBorderColor = CardBorder,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary,
                    cursorColor = IndigoPrimary
                ),
                shape = RoundedCornerShape(14.dp),
                enabled = !emailLockoutStatus.isLocked
            )

            // Strict Authenticated Login Button
            Button(
                onClick = {
                    val targetEmail = email.trim().lowercase()
                    if (targetEmail.isBlank()) {
                        errorMessage = "Please enter your admin email."
                        return@Button
                    }

                    if (!AdminRepository.isWhitelisted(targetEmail)) {
                        errorMessage = "Account '$targetEmail' is not authorized as an admin in the whitelist."
                        return@Button
                    }

                    if (emailLockoutStatus.isLocked) {
                        errorMessage = "🚨 Account is locked for 10 days due to brute force attempts (${emailLockoutStatus.remainingTimeStr} remaining)."
                        return@Button
                    }

                    if (password.isBlank()) {
                        errorMessage = "Please enter your password."
                        return@Button
                    }

                    isLoading = true
                    errorMessage = null
                    coroutineScope.launch {
                        val result = AdminRepository.loginWithEmail(targetEmail, password)
                        isLoading = false
                        result.onSuccess { admin ->
                            Toast.makeText(context, "Welcome ${admin.displayName}!", Toast.LENGTH_SHORT).show()
                            onLoginSuccess()
                        }.onFailure { ex ->
                            // Strictly reject on wrong password
                            errorMessage = ex.message ?: "Invalid email or password."
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (emailLockoutStatus.isLocked) Color(0xFF3B1E22) else IndigoPrimary,
                    disabledContainerColor = Color(0xFF1E293B)
                ),
                enabled = !isLoading && !emailLockoutStatus.isLocked
            ) {
                if (isLoading) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                } else {
                    Text(
                        text = if (emailLockoutStatus.isLocked) "Account Locked (10 Days)" else "Sign In to Admin Console",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }

            // Security Policy Footer Note
            Text(
                text = "🛡️ Brute-force security active: 10 failed attempts triggers a mandatory 10-day lockout. All activity is logged and broadcast to all administrators.",
                fontSize = 10.sp,
                color = TextMuted,
                textAlign = TextAlign.Center,
                lineHeight = 14.sp,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}
