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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.adminapp.data.AdminRepository
import com.example.adminapp.data.ClientItem
import com.example.adminapp.theme.*

@Composable
fun PremiumDashboardScreen() {
    val context = LocalContext.current
    val clients by AdminRepository.clients.collectAsState()
    val isLoading by AdminRepository.isLoadingClients.collectAsState()
    val isSuperAdmin = remember { AdminRepository.isSuperAdmin() }

    var searchQuery by remember { mutableStateOf("") }
    var selectedFilter by remember { mutableStateOf("All") }
    val filterOptions = listOf("All", "Active", "Expired", "Suspended")

    // Password visibility state: Map of client UID to boolean
    var revealedPasswords by remember { mutableStateOf(mapOf<String, Boolean>()) }

    // Initial load trigger
    LaunchedEffect(Unit) {
        if (clients.isEmpty()) {
            AdminRepository.fetchClients()
        }
    }

    // Rotating sync animation
    val infiniteTransition = rememberInfiniteTransition(label = "clientsSync")
    val angle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "syncAngle"
    )

    // Filter clients
    val filteredClients = remember(clients, searchQuery, selectedFilter) {
        clients.filter { client ->
            val matchesFilter = when (selectedFilter) {
                "Active" -> client.status.equals("Active", ignoreCase = true)
                "Expired" -> client.status.equals("Expired", ignoreCase = true)
                "Suspended" -> client.status.equals("Suspended", ignoreCase = true)
                else -> true
            }

            val matchesSearch = if (searchQuery.isBlank()) true else {
                val q = searchQuery.trim().lowercase()
                client.name.lowercase().contains(q) ||
                client.email.lowercase().contains(q) ||
                client.mobile.lowercase().contains(q) ||
                client.gameUid.lowercase().contains(q) ||
                client.linkedGmail.lowercase().contains(q) ||
                client.linkedZoho.lowercase().contains(q) ||
                client.linkedImap.lowercase().contains(q)
            }

            matchesFilter && matchesSearch
        }
    }

    // Stats calculations
    val totalCount = clients.size
    val activeCount = clients.count { it.status.equals("Active", ignoreCase = true) }
    val expiredCount = clients.count { it.status.equals("Expired", ignoreCase = true) }
    val suspendedCount = clients.count { it.status.equals("Suspended", ignoreCase = true) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Top Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(IndigoPrimary.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.WorkspacePremium, contentDescription = null, tint = AmberWarning, modifier = Modifier.size(18.dp))
                }
                Column {
                    Text(
                        text = "PREMIUM DASHBOARD",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = TextPrimary,
                        letterSpacing = 0.5.sp
                    )
                    Text(
                        text = "Manage client subscriptions & Free Fire UIDs",
                        fontSize = 11.sp,
                        color = TextSecondary
                    )
                }
            }

            IconButton(
                onClick = { AdminRepository.fetchClients() },
                enabled = !isLoading,
                modifier = Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(SurfaceDark)
            ) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = "Refresh Clients",
                    tint = IndigoAccent,
                    modifier = if (isLoading) Modifier.rotate(angle) else Modifier
                )
            }
        }

        // Stats Summary Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            StatCard(modifier = Modifier.weight(1f), label = "TOTAL", count = totalCount.toString(), color = IndigoAccent)
            StatCard(modifier = Modifier.weight(1f), label = "ACTIVE", count = activeCount.toString(), color = EmeraldSuccess)
            StatCard(modifier = Modifier.weight(1f), label = "EXPIRED", count = expiredCount.toString(), color = AmberWarning)
            StatCard(modifier = Modifier.weight(1f), label = "BLOCKED", count = suspendedCount.toString(), color = RoseAlert)
        }

        // Search Bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search by name, email, mobile, UID...", fontSize = 12.sp, color = TextMuted) },
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

        // Filter Chips Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            filterOptions.forEach { opt ->
                val isSelected = selectedFilter == opt
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (isSelected) IndigoPrimary else SurfaceDark)
                        .border(
                            1.dp,
                            if (isSelected) IndigoAccent else CardBorder,
                            RoundedCornerShape(10.dp)
                        )
                        .clickable { selectedFilter = opt }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = opt,
                        fontSize = 11.sp,
                        fontWeight = if (isSelected) FontWeight.Black else FontWeight.Bold,
                        color = if (isSelected) Color.White else TextMuted
                    )
                }
            }
        }

        // Header Count
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "SUBSCRIBED CLIENTS (${filteredClients.size})",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = TextMuted,
                letterSpacing = 0.5.sp
            )
            if (isSuperAdmin) {
                Text(
                    text = "SuperAdmin Controls Active",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = AmberWarning
                )
            }
        }

        // Client Cards List
        if (filteredClients.isEmpty()) {
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
                    Icon(Icons.Default.PersonOff, contentDescription = null, tint = TextMuted, modifier = Modifier.size(40.dp))
                    Text("No clients found matching filter", color = TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filteredClients, key = { it.uid }) { client ->
                    val isRevealed = revealedPasswords[client.uid] ?: false

                    ClientCard(
                        client = client,
                        isPasswordRevealed = isRevealed,
                        onTogglePassword = {
                            revealedPasswords = revealedPasswords.toMutableMap().apply {
                                put(client.uid, !isRevealed)
                            }
                        },
                        onCopyPassword = {
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("Client Password", client.password))
                            Toast.makeText(context, "Copied password for ${client.name}", Toast.LENGTH_SHORT).show()
                        },
                        isSuperAdmin = isSuperAdmin,
                        onToggleStatus = {
                            AdminRepository.toggleClientStatus(client)
                            val action = if (client.status == "Active") "Suspended" else "Activated"
                            Toast.makeText(context, "$action client ${client.name}", Toast.LENGTH_SHORT).show()
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun ClientCard(
    client: ClientItem,
    isPasswordRevealed: Boolean,
    onTogglePassword: () -> Unit,
    onCopyPassword: () -> Unit,
    isSuperAdmin: Boolean,
    onToggleStatus: () -> Unit
) {
    val statusBg = when (client.status) {
        "Active" -> EmeraldSuccess.copy(alpha = 0.15f)
        "Suspended" -> RoseAlert.copy(alpha = 0.15f)
        else -> AmberWarning.copy(alpha = 0.15f)
    }
    val statusColor = when (client.status) {
        "Active" -> EmeraldSuccess
        "Suspended" -> RoseAlert
        else -> AmberWarning
    }

    val linkedMail = client.linkedGmail.ifBlank { client.linkedZoho.ifBlank { client.linkedImap } }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(CardDark)
            .border(1.dp, CardBorder, RoundedCornerShape(16.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Row 1: Avatar + Name + Status Chip
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
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(IndigoPrimary.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = client.name.take(1).uppercase(),
                        fontWeight = FontWeight.Black,
                        fontSize = 16.sp,
                        color = IndigoAccent
                    )
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = client.name,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = client.email.ifBlank { "No email registered" },
                        fontSize = 11.sp,
                        color = TextSecondary
                    )
                }
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(statusBg)
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = client.status.uppercase(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = statusColor
                )
            }
        }

        // Row 2: Product & Validity
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(SurfaceDark)
                .padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "📦 ${client.productName}",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFFCBD5E1)
            )

            Text(
                text = "Expires: ${client.expiryDate} (${client.validityDays}d left)",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = if (client.validityDays > 5) EmeraldSuccess else AmberWarning
            )
        }

        // Row 3: Linked Mailbox & Game UID
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (linkedMail.isNotBlank()) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(IndigoPrimary.copy(alpha = 0.12f))
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = "📬 $linkedMail",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = IndigoAccent
                    )
                }
            }

            if (client.gameUid.isNotBlank()) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xFF0F766E).copy(alpha = 0.2f))
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = "🎮 UID: ${client.gameUid}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = CyanAccent
                    )
                }
            }
        }

        // Row 4: Password Reveal & Actions (SuperAdmin Only - Matches Website PremiumDashboard.jsx:L545)
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            if (isSuperAdmin) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "PWD:",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextMuted
                    )

                    Text(
                        text = if (isPasswordRevealed) client.password else "••••••••",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = if (isPasswordRevealed) AmberWarning else TextSecondary
                    )

                    IconButton(onClick = onTogglePassword, modifier = Modifier.size(24.dp)) {
                        Icon(
                            imageVector = if (isPasswordRevealed) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = "Toggle password",
                            tint = TextMuted,
                            modifier = Modifier.size(14.dp)
                        )
                    }

                    IconButton(onClick = onCopyPassword, modifier = Modifier.size(24.dp)) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = "Copy password",
                            tint = TextMuted,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            } else {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(Icons.Default.Lock, contentDescription = null, tint = TextMuted, modifier = Modifier.size(12.dp))
                    Text(
                        text = "Credentials Protected (Superadmin Only)",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextMuted
                    )
                }
            }

            // Super Admin Action Button: Toggle Suspend
            if (isSuperAdmin) {
                OutlinedButton(
                    onClick = onToggleStatus,
                    modifier = Modifier.height(30.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = if (client.status == "Active") RoseAlert else EmeraldSuccess
                    )
                ) {
                    Text(
                        text = if (client.status == "Active") "Suspend" else "Activate",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
fun StatCard(
    modifier: Modifier = Modifier,
    label: String,
    count: String,
    color: Color
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceDark)
            .border(1.dp, CardBorder, RoundedCornerShape(12.dp))
            .padding(vertical = 8.dp, horizontal = 4.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = count,
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
                color = color
            )
            Text(
                text = label,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                color = TextMuted
            )
        }
    }
}
