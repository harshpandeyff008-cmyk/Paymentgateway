package com.example.adminapp.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
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
import com.example.adminapp.data.ConnectedMailbox
import com.example.adminapp.data.LicenseKey
import com.example.adminapp.theme.*

@Composable
fun LicenseKeysScreen() {
    val context = LocalContext.current
    val keys by AdminRepository.licenseKeys.collectAsState()
    val mailboxes by AdminRepository.mailboxes.collectAsState()
    val isSyncing by AdminRepository.isSyncing.collectAsState()
    val syncStatus by AdminRepository.syncStatus.collectAsState()
    val currentUser by AdminRepository.currentUser.collectAsState()
    val isSuperAdmin = remember(currentUser) { AdminRepository.isSuperAdmin() }

    // Strictly accessible mailboxes (SuperAdmin gets all 38; normal admin only gets assigned)
    val accessibleMailboxes = remember(mailboxes, currentUser) { AdminRepository.getAccessibleMailboxes() }
    val hasKeyAccess = remember(currentUser) { AdminRepository.hasLicenseKeyAccess(currentUser) }

    var selectedDuration by remember { mutableStateOf("30 Days") }
    val durations = listOf("1 Day", "7 Days", "30 Days", "Lifetime")
    var selectedMailbox by remember(accessibleMailboxes) { mutableStateOf(accessibleMailboxes.firstOrNull()) }

    var isGeneratorOpen by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedStatusFilter by remember { mutableStateOf("All") }
    val statusFilters = listOf("All", "Active", "Redeemed")

    // Delete confirmation dialog state
    var keyToDelete by remember { mutableStateOf<LicenseKey?>(null) }

    // Rotation animation for sync icon
    val infiniteTransition = rememberInfiniteTransition(label = "syncRotation")
    val angle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "angle"
    )

    // Filtered keys
    val filteredKeys = remember(keys, searchQuery, selectedStatusFilter) {
        keys.filter { k ->
            val matchesStatus = when (selectedStatusFilter) {
                "Active" -> k.status.equals("Active", ignoreCase = true)
                "Redeemed" -> k.status.equals("Redeemed", ignoreCase = true)
                else -> true
            }

            val matchesSearch = if (searchQuery.isBlank()) true else {
                val q = searchQuery.trim().lowercase()
                k.key.lowercase().contains(q) ||
                (k.targetMailbox?.lowercase()?.contains(q) == true) ||
                (k.redeemedBy?.lowercase()?.contains(q) == true) ||
                (k.createdByEmail?.lowercase()?.contains(q) == true)
            }

            matchesStatus && matchesSearch
        }
    }

    val totalKeysCount = keys.size
    val activeKeysCount = keys.count { it.status.equals("Active", ignoreCase = true) }
    val redeemedKeysCount = keys.count { it.status.equals("Redeemed", ignoreCase = true) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Access Denied Banner for unauthorized admins (Matches Website LicenseKeys.jsx:L46)
        if (!hasKeyAccess) {
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF7F1D1D).copy(alpha = 0.3f)),
                border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(Color(0xFFEF4444))),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.Lock, contentDescription = null, tint = Color(0xFFEF4444), modifier = Modifier.size(20.dp))
                    Column {
                        Text("Access Restricted: Read-Only Mode", fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFFFCA5A5))
                        Text("Only Superadmin or authorized admins (allowLicenseKeys) can generate keys.", fontSize = 10.sp, color = TextSecondary)
                    }
                }
            }
        }

        // --- Top Bar: Firestore Sync & Generator Toggle Button ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Live Firestore Status Badge
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(SurfaceDark)
                    .border(1.dp, CardBorder, RoundedCornerShape(8.dp))
                    .clickable { AdminRepository.syncWithFirebase() }
                    .padding(horizontal = 10.dp, vertical = 6.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(if (isSyncing) IndigoAccent else EmeraldGlow)
                )
                Text(
                    text = if (isSyncing) "Syncing..." else "Firestore Live",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Icon(
                    imageVector = Icons.Default.Sync,
                    contentDescription = "Sync",
                    tint = IndigoAccent,
                    modifier = Modifier
                        .size(14.dp)
                        .then(if (isSyncing) Modifier.rotate(angle) else Modifier)
                )
            }

            // Toggle Generator Button (+ Generate Key)
            Button(
                onClick = { isGeneratorOpen = !isGeneratorOpen },
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isGeneratorOpen) Color(0xFF1E293B) else IndigoPrimary
                ),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Icon(
                    imageVector = if (isGeneratorOpen) Icons.Default.Close else Icons.Default.Add,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = if (isGeneratorOpen) "Hide Generator" else "+ New Key",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        // --- Collapsible Generator Card ---
        AnimatedVisibility(
            visible = isGeneratorOpen,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(CardDark)
                    .border(1.2.dp, IndigoPrimary.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Generate License Key",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = TextPrimary
                    )
                    Text(
                        text = "Format: XXXX-XXXX-XXXX-XXXX",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextMuted
                    )
                }

                // Duration selection pills
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    durations.forEach { duration ->
                        val isSelected = selectedDuration == duration
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isSelected) IndigoPrimary else SurfaceDark)
                                .border(
                                    1.dp,
                                    if (isSelected) IndigoAccent else CardBorder,
                                    RoundedCornerShape(8.dp)
                                )
                                .clickable { selectedDuration = duration }
                                .padding(vertical = 7.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = duration,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Black else FontWeight.Medium,
                                color = if (isSelected) Color.White else TextSecondary
                            )
                        }
                    }
                }

                // Target Mailbox Dropdown
                var expandedMailboxDropdown by remember { mutableStateOf(false) }
                Box(modifier = Modifier.fillMaxWidth()) {
                    OutlinedButton(
                        onClick = { expandedMailboxDropdown = true },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary),
                        border = ButtonDefaults.outlinedButtonBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(CardBorder)),
                        contentPadding = PaddingValues(horizontal = 10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(horizontalAlignment = Alignment.Start) {
                                Text("Assigned Target Mailbox", fontSize = 9.sp, color = TextMuted)
                                Text(
                                    text = selectedMailbox?.let { "${it.email} (${it.type.name})" } ?: "Select Mailbox",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = IndigoAccent,
                                    maxLines = 1
                                )
                            }
                            Icon(Icons.Default.ArrowDropDown, contentDescription = null, tint = TextMuted)
                        }
                    }

                    DropdownMenu(
                        expanded = expandedMailboxDropdown,
                        onDismissRequest = { expandedMailboxDropdown = false },
                        modifier = Modifier
                            .background(SurfaceDark)
                            .fillMaxWidth(0.85f)
                    ) {
                        accessibleMailboxes.forEach { mb ->
                            DropdownMenuItem(
                                text = {
                                    Column {
                                        Text(mb.email, fontWeight = FontWeight.Bold, color = TextPrimary, fontSize = 12.sp)
                                        Text("${mb.type.name} • ${mb.gameIdName ?: "Game ID"}", fontSize = 10.sp, color = TextMuted)
                                    }
                                },
                                onClick = {
                                    selectedMailbox = mb
                                    expandedMailboxDropdown = false
                                }
                            )
                        }
                    }
                }

                // Generate Button
                Button(
                    onClick = {
                        val target = selectedMailbox ?: accessibleMailboxes.firstOrNull()
                        if (target != null) {
                            val newKey = AdminRepository.generateLicenseKey(selectedDuration, target)
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("License Key", newKey.key))
                            Toast.makeText(context, "Generated & Copied: ${newKey.key}", Toast.LENGTH_LONG).show()
                            isGeneratorOpen = false // Collapse generator after creation
                        } else {
                            Toast.makeText(context, "Please select an assigned mailbox first", Toast.LENGTH_SHORT).show()
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
                ) {
                    Icon(Icons.Default.Key, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Generate & Copy Key", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }
        }

        // --- Compact Quick Stats & Search Bar ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Stats pills
            CompactStatBadge(label = "Total", count = totalKeysCount.toString(), color = IndigoAccent, modifier = Modifier.weight(1f))
            CompactStatBadge(label = "Active", count = activeKeysCount.toString(), color = EmeraldSuccess, modifier = Modifier.weight(1f))
            CompactStatBadge(label = "Used", count = redeemedKeysCount.toString(), color = AmberWarning, modifier = Modifier.weight(1f))
        }

        // Search Box
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search license key, mailbox, client...", fontSize = 12.sp, color = TextMuted) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextMuted, modifier = Modifier.size(16.dp)) },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { searchQuery = "" }) {
                        Icon(Icons.Default.Close, contentDescription = "Clear", tint = TextMuted, modifier = Modifier.size(14.dp))
                    }
                }
            },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .height(46.dp),
            shape = RoundedCornerShape(10.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = IndigoPrimary,
                unfocusedBorderColor = CardBorder,
                focusedContainerColor = SurfaceDark,
                unfocusedContainerColor = SurfaceDark,
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary
            )
        )

        // Status Filter Chips
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            statusFilters.forEach { filter ->
                val isSelected = selectedStatusFilter == filter
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (isSelected) IndigoPrimary else SurfaceDark)
                        .border(1.dp, if (isSelected) IndigoAccent else CardBorder, RoundedCornerShape(8.dp))
                        .clickable { selectedStatusFilter = filter }
                        .padding(vertical = 6.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = filter,
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
                text = "KEYS LIST (${filteredKeys.size})",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = TextMuted,
                letterSpacing = 0.5.sp
            )
            if (!isSuperAdmin) {
                Text(
                    text = "Normal Admin Access",
                    fontSize = 10.sp,
                    color = IndigoAccent
                )
            }
        }

        // --- Keys List ---
        if (filteredKeys.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(Icons.Default.KeyOff, contentDescription = null, tint = TextMuted, modifier = Modifier.size(36.dp))
                    Text("No license keys found", color = TextSecondary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filteredKeys, key = { it.key }) { license ->
                    val canDelete = remember(license, isSuperAdmin) { AdminRepository.canDeleteLicenseKey(license) }

                    ModernLicenseKeyCard(
                        license = license,
                        canDelete = canDelete,
                        onCopy = { key ->
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("License Key", key))
                            Toast.makeText(context, "📋 Copied: $key", Toast.LENGTH_SHORT).show()
                        },
                        onDeleteRequest = {
                            keyToDelete = license
                        }
                    )
                }
            }
        }
    }

    // Revoke Key Confirmation Dialog
    keyToDelete?.let { license ->
        AlertDialog(
            onDismissRequest = { keyToDelete = null },
            title = {
                Text("Revoke License Key?", fontWeight = FontWeight.Black, color = TextPrimary, fontSize = 16.sp)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Are you sure you want to permanently revoke this key from Firestore?", color = TextSecondary, fontSize = 12.sp)
                    Text(license.key, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, color = RoseAlert, fontSize = 13.sp)
                    license.targetMailbox?.let {
                        Text("Target Mailbox: $it", color = TextMuted, fontSize = 11.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val success = AdminRepository.deleteLicenseKey(license.key)
                        keyToDelete = null
                        if (success) {
                            Toast.makeText(context, "Key revoked and deleted from Firestore", Toast.LENGTH_SHORT).show()
                        } else {
                            Toast.makeText(context, "Access Denied: You can only delete keys you generated.", Toast.LENGTH_SHORT).show()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = RoseAlert)
                ) {
                    Text("Revoke Key", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { keyToDelete = null }) {
                    Text("Cancel", color = TextSecondary)
                }
            },
            containerColor = CardDark,
            shape = RoundedCornerShape(18.dp)
        )
    }
}

@Composable
fun CompactStatBadge(
    label: String,
    count: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(SurfaceDark)
            .border(1.dp, CardBorder, RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 5.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, fontSize = 10.sp, color = TextMuted, fontWeight = FontWeight.Bold)
        Text(count, fontSize = 12.sp, color = color, fontWeight = FontWeight.Black)
    }
}

@Composable
fun ModernLicenseKeyCard(
    license: LicenseKey,
    canDelete: Boolean,
    onCopy: (String) -> Unit,
    onDeleteRequest: () -> Unit
) {
    val isActive = license.status.equals("Active", ignoreCase = true)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(SurfaceDark)
            .border(1.dp, if (isActive) CardBorder else Color(0xFF262626), RoundedCornerShape(14.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Top Row: Monospace Key and Action Icons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = license.key,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = if (isActive) TextPrimary else TextMuted,
                letterSpacing = 0.5.sp
            )

            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                // Copy Button
                IconButton(
                    onClick = { onCopy(license.key) },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        Icons.Default.ContentCopy,
                        contentDescription = "Copy",
                        tint = IndigoAccent,
                        modifier = Modifier.size(16.dp)
                    )
                }

                // Delete Button
                if (canDelete) {
                    IconButton(
                        onClick = onDeleteRequest,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            Icons.Default.Delete,
                            contentDescription = "Revoke",
                            tint = RoseAlert.copy(alpha = 0.85f),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                } else {
                    IconButton(
                        onClick = {},
                        enabled = false,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            Icons.Default.Lock,
                            contentDescription = "Protected",
                            tint = TextMuted.copy(alpha = 0.3f),
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
        }

        // Badges Row: Duration, Status, Target Mailbox
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            // Duration Badge
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(IndigoPrimary.copy(alpha = 0.18f))
                    .padding(horizontal = 7.dp, vertical = 2.dp)
            ) {
                Text(
                    text = license.duration,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = IndigoAccent
                )
            }

            // Status Badge
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(
                        if (isActive) EmeraldSuccess.copy(alpha = 0.15f) else AmberWarning.copy(alpha = 0.15f)
                    )
                    .padding(horizontal = 7.dp, vertical = 2.dp)
            ) {
                Text(
                    text = license.status.uppercase(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = if (isActive) EmeraldGlow else AmberWarning
                )
            }

            // Target Mailbox
            license.targetMailbox?.let { mb ->
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xFF0F172A))
                        .border(0.8.dp, CardBorder, RoundedCornerShape(6.dp))
                        .padding(horizontal = 7.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = "📧 ${mb.substringBefore('@')}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = CyanAccent,
                        maxLines = 1
                    )
                }
            }
        }

        // Details Row: Created By & Redeemed By
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (!license.createdByEmail.isNullOrBlank()) {
                Text(
                    text = "By: ${license.createdByEmail.substringBefore('@')}",
                    fontSize = 10.sp,
                    color = TextMuted
                )
            }
            if (!license.redeemedBy.isNullOrBlank()) {
                Text(
                    text = "Used by: ${license.redeemedBy}",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = AmberWarning
                )
            }
        }
    }
}
