package com.example.adminapp.ui.screens

import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.adminapp.data.AdminRepository
import com.example.adminapp.data.SupportChatMessage
import com.example.adminapp.data.SupportChatSession
import com.example.adminapp.theme.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun SupportChatScreen(
    initialClientUid: String? = null
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val chatSessions by AdminRepository.supportChats.collectAsState()
    val allMessages by AdminRepository.supportMessages.collectAsState()

    var selectedSessionUid by remember {
        mutableStateOf(initialClientUid ?: chatSessions.firstOrNull()?.clientUid)
    }

    // On mobile, if a chat is selected we show the conversation, else we show session list
    var isMobileChatOpen by remember {
        mutableStateOf(initialClientUid != null)
    }

    val selectedSession = remember(selectedSessionUid, chatSessions) {
        chatSessions.find { it.clientUid == selectedSessionUid }
    }

    val currentMessages = remember(selectedSessionUid, allMessages) {
        allMessages[selectedSessionUid] ?: emptyList()
    }

    var messageInput by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    // Auto-scroll when messages update
    LaunchedEffect(currentMessages.size) {
        if (currentMessages.isNotEmpty()) {
            listState.animateScrollToItem(currentMessages.size - 1)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
    ) {
        if (!isMobileChatOpen || selectedSession == null) {
            // ==========================================
            // VIEW 1: CLIENT SESSIONS LIST
            // ==========================================
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Header Bar
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "SUPPORT DESK",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Black,
                            color = TextPrimary,
                            letterSpacing = 0.5.sp
                        )
                        Text(
                            text = "${chatSessions.size} client conversations active",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }

                    // Simulate Client Ping to test Notifications
                    Button(
                        onClick = {
                            val target = chatSessions.firstOrNull()
                            if (target != null) {
                                AdminRepository.simulateClientSupportMessage(
                                    target.clientUid,
                                    "Bhai OTP verify kar do! (Push notification test)"
                                )
                                Toast.makeText(context, "Client message simulated! Check phone notification.", Toast.LENGTH_SHORT).show()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary),
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Icon(Icons.Default.NotificationsActive, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Test Notification", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }

                // Sessions List
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(chatSessions, key = { it.clientUid }) { session ->
                        val isRequesting = session.status.equals("requesting", ignoreCase = true)

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(SurfaceDark)
                                .border(
                                    1.2.dp,
                                    if (isRequesting) RoseAlert.copy(alpha = 0.7f) else CardBorder,
                                    RoundedCornerShape(14.dp)
                                )
                                .clickable {
                                    selectedSessionUid = session.clientUid
                                    isMobileChatOpen = true
                                    if (isRequesting) {
                                        AdminRepository.acceptSupportSession(session.clientUid)
                                    }
                                }
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            // Avatar
                            Box(
                                modifier = Modifier
                                    .size(42.dp)
                                    .clip(CircleShape)
                                    .background(
                                        if (isRequesting) RoseAlert.copy(alpha = 0.2f) else IndigoPrimary.copy(alpha = 0.2f)
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = session.clientName.take(1).uppercase(),
                                    fontWeight = FontWeight.Black,
                                    fontSize = 16.sp,
                                    color = if (isRequesting) RoseAlert else IndigoAccent
                                )
                            }

                            // Session Info
                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = session.clientName,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary
                                    )
                                    
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(4.dp))
                                            .background(
                                                if (isRequesting) RoseAlert.copy(alpha = 0.2f) else EmeraldSuccess.copy(alpha = 0.15f)
                                            )
                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                    ) {
                                        Text(
                                            text = session.status.uppercase(),
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Black,
                                            color = if (isRequesting) RoseAlert else EmeraldGlow
                                        )
                                    }
                                }

                                Text(
                                    text = session.lastMessage.ifBlank { "No messages yet" },
                                    fontSize = 11.sp,
                                    color = if (session.unreadCount > 0) TextPrimary else TextMuted,
                                    fontWeight = if (session.unreadCount > 0) FontWeight.Bold else FontWeight.Normal,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )

                                Text(
                                    text = session.clientEmail,
                                    fontSize = 10.sp,
                                    color = TextMuted
                                )
                            }

                            if (session.unreadCount > 0) {
                                Box(
                                    modifier = Modifier
                                        .size(20.dp)
                                        .clip(CircleShape)
                                        .background(RoseAlert),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = session.unreadCount.toString(),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color.White
                                    )
                                }
                            }
                        }
                    }
                }
            }
        } else {
            // ==========================================
            // VIEW 2: ACTIVE CONVERSATION
            // ==========================================
            Column(
                modifier = Modifier.fillMaxSize()
            ) {
                // Chat Conversation Top Bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(SurfaceDark)
                        .border(1.dp, CardBorder)
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    IconButton(
                        onClick = { isMobileChatOpen = false },
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = selectedSession.clientName,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Black,
                            color = TextPrimary
                        )
                        Text(
                            text = selectedSession.clientEmail,
                            fontSize = 10.sp,
                            color = TextMuted,
                            maxLines = 1
                        )
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(
                                if (selectedSession.status == "requesting") RoseAlert.copy(alpha = 0.2f) else EmeraldSuccess.copy(alpha = 0.15f)
                            )
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = selectedSession.status.uppercase(),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = if (selectedSession.status == "requesting") RoseAlert else EmeraldGlow
                        )
                    }
                }

                // Chat Messages
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(currentMessages, key = { it.id }) { msg ->
                        SupportMessageBubble(msg = msg)
                    }
                }

                // Quick Canned Reply Chips
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(SurfaceDark.copy(alpha = 0.6f))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    val templates = listOf(
                        "👋 Hello! Checking now.",
                        "🛡️ Escrow verified.",
                        "⚡ OTP delivered.",
                        "✅ Mailbox ready."
                    )
                    templates.forEach { tmpl ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(CardDark)
                                .border(0.8.dp, CardBorder, RoundedCornerShape(8.dp))
                                .clickable {
                                    AdminRepository.sendSupportMessage(selectedSession.clientUid, tmpl)
                                }
                                .padding(horizontal = 8.dp, vertical = 5.dp)
                        ) {
                            Text(tmpl, fontSize = 10.sp, color = IndigoAccent, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                // Bottom Input Row
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(SurfaceDark)
                        .border(1.dp, CardBorder)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = messageInput,
                        onValueChange = { messageInput = it },
                        placeholder = { Text("Type reply as administrator...", fontSize = 12.sp, color = TextMuted) },
                        modifier = Modifier
                            .weight(1f)
                            .height(46.dp),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = IndigoPrimary,
                            unfocusedBorderColor = CardBorder,
                            focusedContainerColor = CardDark,
                            unfocusedContainerColor = CardDark,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )

                    IconButton(
                        onClick = {
                            if (messageInput.isNotBlank()) {
                                AdminRepository.sendSupportMessage(selectedSession.clientUid, messageInput)
                                messageInput = ""
                            }
                        },
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(IndigoPrimary)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Send,
                            contentDescription = "Send",
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun SupportMessageBubble(msg: SupportChatMessage) {
    val timeFormatted = remember(msg.timestamp) {
        val sdf = SimpleDateFormat("hh:mm a", Locale.getDefault())
        sdf.format(Date(msg.timestamp))
    }

    val isMe = msg.isAdmin

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = if (isMe) Alignment.End else Alignment.Start
    ) {
        Text(
            text = if (isMe) "Admin Desk" else msg.senderName,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = if (isMe) IndigoAccent else CyanAccent,
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
        )

        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(
                    RoundedCornerShape(
                        topStart = 14.dp,
                        topEnd = 14.dp,
                        bottomStart = if (isMe) 14.dp else 2.dp,
                        bottomEnd = if (isMe) 2.dp else 14.dp
                    )
                )
                .background(
                    if (isMe) {
                        Brush.linearGradient(listOf(IndigoPrimary, Color(0xFF4338CA)))
                    } else {
                        Brush.linearGradient(listOf(SurfaceDark, CardDark))
                    }
                )
                .border(
                    1.dp,
                    if (isMe) IndigoAccent.copy(alpha = 0.4f) else CardBorder,
                    RoundedCornerShape(14.dp)
                )
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = msg.text,
                    fontSize = 13.sp,
                    color = Color.White,
                    lineHeight = 17.sp
                )
                Text(
                    text = timeFormatted,
                    fontSize = 9.sp,
                    color = if (isMe) Color.White.copy(alpha = 0.7f) else TextMuted,
                    modifier = Modifier.align(Alignment.End)
                )
            }
        }
    }
}
