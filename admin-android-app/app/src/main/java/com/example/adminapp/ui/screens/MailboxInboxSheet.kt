package com.example.adminapp.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.animation.core.*
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.adminapp.data.AdminRepository
import com.example.adminapp.data.ConnectedMailbox
import com.example.adminapp.data.MailMessage
import com.example.adminapp.data.MailboxType
import com.example.adminapp.theme.*
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MailboxInboxSheet(
    mailbox: ConnectedMailbox,
    onClose: () -> Unit
) {
    val context = LocalContext.current
    val messages by AdminRepository.mailboxMessages.collectAsState()
    val isLoading by AdminRepository.isLoadingInbox.collectAsState()

    var searchQuery by remember { mutableStateOf("") }
    var selectedMessageDetails by remember { mutableStateOf<MailMessage?>(null) }
    var copiedOtp by remember { mutableStateOf<String?>(null) }

    // Rotating sync animation
    val infiniteTransition = rememberInfiniteTransition(label = "inboxSync")
    val angle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "syncAngle"
    )

    // Filter messages
    val filteredMessages = remember(messages, searchQuery) {
        if (searchQuery.isBlank()) messages
        else {
            val q = searchQuery.trim().lowercase()
            messages.filter {
                it.subject.lowercase().contains(q) ||
                it.sender.lowercase().contains(q) ||
                it.snippet.lowercase().contains(q) ||
                (it.otpCode != null && it.otpCode.contains(q))
            }
        }
    }

    // Latest OTP found in this mailbox
    val latestOtpMessage = remember(messages) {
        messages.firstOrNull { it.otpCode != null }
    }

    val typeColor = when (mailbox.type) {
        MailboxType.GMAIL -> IndigoAccent
        MailboxType.ZOHO -> Color(0xFFC084FC)
        MailboxType.IMAP -> AmberWarning
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = BackgroundDark
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    IconButton(
                        onClick = onClose,
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(SurfaceDark)
                    ) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary, modifier = Modifier.size(18.dp))
                    }

                    Column(modifier = Modifier.weight(1f)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = mailbox.email,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Black,
                                color = TextPrimary,
                                maxLines = 1
                            )
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(typeColor.copy(alpha = 0.15f))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = mailbox.type.name,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = typeColor
                                )
                            }
                            if (!mailbox.gameIdName.isNullOrBlank()) {
                                Text(
                                    text = "🎮 ${mailbox.gameIdName}",
                                    fontSize = 11.sp,
                                    color = CyanAccent,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }

                // Refresh Button
                IconButton(
                    onClick = { AdminRepository.openMailboxInbox(mailbox) },
                    enabled = !isLoading,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(SurfaceDark)
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Refresh",
                        tint = IndigoAccent,
                        modifier = if (isLoading) Modifier.rotate(angle) else Modifier
                    )
                }
            }

            // GARENA OTP HERO BANNER (Instant Visibility)
            if (latestOtpMessage != null && latestOtpMessage.otpCode != null) {
                val otp = latestOtpMessage.otpCode
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(
                            Brush.horizontalGradient(
                                listOf(
                                    Color(0xFF1E1B4B),
                                    Color(0xFF311042)
                                )
                            )
                        )
                        .border(1.5.dp, Brush.horizontalGradient(listOf(IndigoPrimary, Color(0xFFA855F7))), RoundedCornerShape(16.dp))
                        .padding(14.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(EmeraldSuccess)
                                )
                                Text(
                                    text = "LIVE GARENA VERIFICATION CODE",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = AmberWarning,
                                    letterSpacing = 0.5.sp
                                )
                            }

                            Text(
                                text = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date(latestOtpMessage.timestamp)),
                                fontSize = 10.sp,
                                color = TextMuted,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = otp,
                                fontSize = 28.sp,
                                fontWeight = FontWeight.Black,
                                color = Color.White,
                                fontFamily = FontFamily.Monospace,
                                letterSpacing = 4.sp
                            )

                            Button(
                                onClick = {
                                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                    clipboard.setPrimaryClip(ClipData.newPlainText("Garena OTP", otp))
                                    copiedOtp = otp
                                    Toast.makeText(context, "OTP $otp Copied!", Toast.LENGTH_SHORT).show()
                                },
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (copiedOtp == otp) EmeraldSuccess else IndigoPrimary
                                ),
                                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                            ) {
                                Icon(
                                    imageVector = if (copiedOtp == otp) Icons.Default.Check else Icons.Default.ContentCopy,
                                    contentDescription = null,
                                    modifier = Modifier.size(14.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = if (copiedOtp == otp) "COPIED" else "COPY OTP",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Black
                                )
                            }
                        }
                    }
                }
            }

            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search emails in this mailbox...", fontSize = 12.sp, color = TextMuted) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp)) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Close, contentDescription = "Clear", tint = TextMuted, modifier = Modifier.size(16.dp))
                        }
                    }
                },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = IndigoPrimary,
                    unfocusedBorderColor = CardBorder,
                    focusedContainerColor = SurfaceDark,
                    unfocusedContainerColor = SurfaceDark,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary
                )
            )

            // Header Count
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "INBOX MESSAGES (${filteredMessages.size})",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = TextMuted,
                    letterSpacing = 0.5.sp
                )
                if (isLoading) {
                    Text(
                        text = "Syncing live via IMAP...",
                        fontSize = 10.sp,
                        color = IndigoAccent,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Message List
            if (filteredMessages.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.Inbox, contentDescription = null, tint = TextMuted, modifier = Modifier.size(40.dp))
                        Text("No messages found", color = TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(filteredMessages, key = { it.id }) { msg ->
                        MessageCard(
                            message = msg,
                            onClick = { selectedMessageDetails = msg },
                            onCopyOtp = { code ->
                                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                clipboard.setPrimaryClip(ClipData.newPlainText("OTP", code))
                                Toast.makeText(context, "OTP $code Copied!", Toast.LENGTH_SHORT).show()
                            }
                        )
                    }
                }
            }
        }
    }

    // Message Detail Dialog
    if (selectedMessageDetails != null) {
        val msg = selectedMessageDetails!!
        Dialog(onDismissRequest = { selectedMessageDetails = null }) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp)),
                color = SurfaceDark
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Email Details",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Black,
                            color = TextPrimary
                        )
                        IconButton(onClick = { selectedMessageDetails = null }) {
                            Icon(Icons.Default.Close, contentDescription = "Close", tint = TextMuted)
                        }
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            text = msg.subject,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Text(
                            text = "From: ${msg.sender}",
                            fontSize = 12.sp,
                            color = IndigoAccent,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = "Date: ${SimpleDateFormat("MMM dd, yyyy • hh:mm a", Locale.getDefault()).format(Date(msg.timestamp))}",
                            fontSize = 11.sp,
                            color = TextMuted
                        )
                    }

                    if (msg.otpCode != null) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(IndigoPrimary.copy(alpha = 0.15f))
                                .border(1.dp, IndigoPrimary.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                                .padding(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column {
                                    Text("DETECTED OTP CODE", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = AmberWarning)
                                    Text(msg.otpCode, fontSize = 22.sp, fontWeight = FontWeight.Black, color = Color.White, fontFamily = FontFamily.Monospace)
                                }
                                Button(
                                    onClick = {
                                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                        clipboard.setPrimaryClip(ClipData.newPlainText("OTP", msg.otpCode))
                                        Toast.makeText(context, "OTP ${msg.otpCode} Copied!", Toast.LENGTH_SHORT).show()
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text("Copy OTP", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 100.dp, max = 260.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(CardDark)
                            .padding(12.dp)
                    ) {
                        Text(
                            text = msg.body,
                            fontSize = 12.sp,
                            color = TextSecondary,
                            lineHeight = 18.sp
                        )
                    }

                    Button(
                        onClick = { selectedMessageDetails = null },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
                    ) {
                        Text("Dismiss", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun MessageCard(
    message: MailMessage,
    onClick: () -> Unit,
    onCopyOtp: (String) -> Unit
) {
    val hasOtp = message.otpCode != null

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(if (hasOtp) Color(0xFF1E1E38) else CardDark)
            .border(
                1.dp,
                if (hasOtp) IndigoPrimary.copy(alpha = 0.5f) else CardBorder,
                RoundedCornerShape(14.dp)
            )
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Avatar icon
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(if (hasOtp) IndigoPrimary.copy(alpha = 0.2f) else SurfaceDark),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = if (hasOtp) Icons.Default.Shield else Icons.Default.Mail,
                contentDescription = null,
                tint = if (hasOtp) AmberWarning else IndigoAccent,
                modifier = Modifier.size(18.dp)
            )
        }

        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = message.sender.substringBefore('<').trim().ifBlank { message.sender },
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    maxLines = 1,
                    modifier = Modifier.weight(1f)
                )

                Text(
                    text = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(Date(message.timestamp)),
                    fontSize = 10.sp,
                    color = TextMuted
                )
            }

            Text(
                text = message.subject,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (hasOtp) Color(0xFFE2E8F0) else TextSecondary,
                maxLines = 1
            )

            Text(
                text = message.snippet,
                fontSize = 11.sp,
                color = TextMuted,
                maxLines = 2,
                lineHeight = 15.sp
            )

            if (hasOtp) {
                Row(
                    modifier = Modifier.padding(top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(IndigoPrimary.copy(alpha = 0.25f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "OTP: ${message.otpCode}",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            color = AmberWarning,
                            fontFamily = FontFamily.Monospace
                        )
                    }

                    Text(
                        text = "• Tap to view full body",
                        fontSize = 10.sp,
                        color = TextMuted
                    )
                }
            }
        }

        if (hasOtp) {
            IconButton(
                onClick = { onCopyOtp(message.otpCode!!) },
                modifier = Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(IndigoPrimary.copy(alpha = 0.2f))
            ) {
                Icon(
                    imageVector = Icons.Default.ContentCopy,
                    contentDescription = "Copy OTP",
                    tint = AmberWarning,
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}
