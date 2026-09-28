package com.example.adminapp.ui.screens

import android.Manifest
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.example.adminapp.MainActivity
import com.example.adminapp.data.AdminRepository
import com.example.adminapp.data.GarenaOtp
import com.example.adminapp.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun OtpMonitorScreen() {
    val context = LocalContext.current
    val otpList by AdminRepository.otpList.collectAsState()
    val mailboxes by AdminRepository.mailboxes.collectAsState()
    val notificationPermissionGranted by AdminRepository.notificationPermissionGranted.collectAsState()

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        AdminRepository.notificationPermissionGranted.value = granted
        if (granted) {
            Toast.makeText(context, "Notification permission granted!", Toast.LENGTH_SHORT).show()
        }
    }

    val isSuperAdmin = remember { AdminRepository.isSuperAdmin() }
    val accessibleMailboxEmails = remember(mailboxes) {
        AdminRepository.getAccessibleMailboxes().map { it.email.lowercase() }.toSet()
    }
    val accessibleOtps = remember(otpList, accessibleMailboxEmails, isSuperAdmin) {
        if (isSuperAdmin) otpList else otpList.filter { accessibleMailboxEmails.contains(it.recipientMailbox.lowercase()) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Notification Permission Reminder if not granted
        if (!notificationPermissionGranted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(RoseAlert.copy(alpha = 0.15f))
                    .border(1.dp, RoseAlert.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                    .clickable {
                        permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    }
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.NotificationsActive,
                        contentDescription = null,
                        tint = RoseAlert,
                        modifier = Modifier.size(20.dp)
                    )
                    Text(
                        text = "Enable phone notifications to get 8-digit OTP alerts on lockscreen!",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = RoseAlert,
                        lineHeight = 15.sp
                    )
                }
                Text(
                    text = "ALLOW",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = RoseAlert,
                    modifier = Modifier.padding(start = 8.dp)
                )
            }
        }

        // Status Bar Banner
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(CardDark)
                .border(1.dp, CardBorder, RoundedCornerShape(16.dp))
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(RoundedCornerShape(5.dp))
                        .background(EmeraldSuccess)
                )
                Column {
                    Text(
                        text = "Real-time Garena Scanner",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = TextPrimary
                    )
                    Text(
                        text = "Monitoring ${mailboxes.size} linked mailbox(es)",
                        fontSize = 11.sp,
                        color = TextSecondary
                    )
                }
            }
        }

        // Section Title & Counter
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Detected OTPs (${accessibleOtps.size})",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )

            if (accessibleOtps.isNotEmpty()) {
                Text(
                    text = "Clear All",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = RoseAlert,
                    modifier = Modifier.clickable {
                        AdminRepository.clearAllOtps()
                        Toast.makeText(context, "Cleared all OTP records", Toast.LENGTH_SHORT).show()
                    }
                )
            }
        }

        // Empty State or List
        if (accessibleOtps.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .clip(RoundedCornerShape(20.dp))
                    .background(SurfaceDark)
                    .border(1.dp, CardBorder, RoundedCornerShape(20.dp))
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Mail,
                        contentDescription = null,
                        tint = TextMuted,
                        modifier = Modifier.size(48.dp)
                    )
                    Text(
                        text = "No Garena OTPs Yet",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = "When an email from Garena arrives, the 8-digit verification code will automatically appear here with a 1-click Copy button.",
                        fontSize = 12.sp,
                        color = TextSecondary,
                        textAlign = TextAlign.Center,
                        lineHeight = 16.sp
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(accessibleOtps, key = { it.id }) { otp ->
                    GarenaOtpCard(otp = otp, onCopy = { code ->
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        val clip = ClipData.newPlainText("Garena OTP", code)
                        clipboard.setPrimaryClip(clip)
                        AdminRepository.markOtpCopied(otp.id)
                        
                        // Haptic feedback on copy
                        try {
                            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                                vm?.defaultVibrator
                            } else {
                                @Suppress("DEPRECATION")
                                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                            }
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                vibrator?.vibrate(VibrationEffect.createOneShot(50, VibrationEffect.DEFAULT_AMPLITUDE))
                            } else {
                                @Suppress("DEPRECATION")
                                vibrator?.vibrate(50)
                            }
                        } catch (e: Exception) {}

                        Toast.makeText(context, "Copied OTP: $code to clipboard!", Toast.LENGTH_SHORT).show()
                    })
                }
            }
        }
    }
}

@Composable
fun GarenaOtpCard(
    otp: GarenaOtp,
    onCopy: (String) -> Unit
) {
    val formattedTime = remember(otp.timestamp) {
        val sdf = SimpleDateFormat("hh:mm:ss a, dd MMM", Locale.getDefault())
        sdf.format(Date(otp.timestamp))
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        CardDark,
                        Color(0xFF0F182E)
                    )
                )
            )
            .border(
                1.5.dp,
                if (otp.isCopied) EmeraldSuccess.copy(alpha = 0.6f) else CardBorder,
                RoundedCornerShape(20.dp)
            )
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Top Card Badge & Timestamp
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(EmeraldSuccess.copy(alpha = 0.15f))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "GARENA VERIFICATION",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = EmeraldGlow,
                        letterSpacing = 0.5.sp
                    )
                }

                if (otp.isCopied) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(IndigoPrimary.copy(alpha = 0.2f))
                            .padding(horizontal = 6.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "COPIED",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = IndigoAccent
                        )
                    }
                }
            }

            Text(
                text = formattedTime,
                fontSize = 11.sp,
                color = TextMuted,
                fontWeight = FontWeight.Medium
            )
        }

        // HUGE 8-DIGIT OTP DISPLAY WITH 1-CLICK COPY BUTTON
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(SurfaceDark)
                .border(1.dp, CardBorder, RoundedCornerShape(14.dp))
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = "8-Digit OTP Code",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextMuted,
                    textDecoration = null
                )
                // Formatted 8 digits: e.g. "8492 0175"
                val displayOtp = if (otp.otpCode.length == 8) {
                    "${otp.otpCode.substring(0, 4)} ${otp.otpCode.substring(4)}"
                } else {
                    otp.otpCode
                }

                Text(
                    text = displayOtp,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                    color = EmeraldGlow,
                    letterSpacing = 2.sp
                )
            }

            // High-Impact 1-Click Copy Button
            Button(
                onClick = { onCopy(otp.otpCode) },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (otp.isCopied) EmeraldSuccess else IndigoPrimary
                ),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp)
            ) {
                Icon(
                    imageVector = if (otp.isCopied) Icons.Default.Check else Icons.Default.ContentCopy,
                    contentDescription = "Copy OTP",
                    tint = Color.White,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = if (otp.isCopied) "Copied!" else "Copy",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White
                )
            }
        }

        // Email Source Details
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = "Mailbox: ${otp.recipientMailbox}",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextSecondary
                )
                Text(
                    text = "From: ${otp.sender}",
                    fontSize = 10.sp,
                    color = TextMuted
                )
            }
        }
    }
}

fun triggerSystemNotification(context: Context, otpCode: String, mailbox: String) {
    com.example.adminapp.util.NotificationHelper.showOtpNotification(context, otpCode, mailbox)
}
