package com.example.adminapp.ui.screens

import kotlinx.coroutines.launch
import com.example.adminapp.data.ConnectedMailbox
import com.example.adminapp.data.MailboxType

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.adminapp.data.AdminRepository
import com.example.adminapp.data.AdminUser
import com.example.adminapp.theme.*

@Composable
fun AdminsScreen() {
    val context = LocalContext.current
    val currentUser by AdminRepository.currentUser.collectAsState()
    val admins by AdminRepository.authorizedAdmins.collectAsState()
    val mailboxes by AdminRepository.mailboxes.collectAsState()
    val coroutineScope = rememberCoroutineScope()
    var showAddDialog by remember { mutableStateOf(false) }
    var adminToEdit by remember { mutableStateOf<AdminUser?>(null) }

    val isRoot = currentUser?.email?.lowercase() == AdminRepository.ROOT_SUPERADMIN.lowercase() || 
            currentUser?.role?.lowercase() == "superadmin"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Authorized Admins",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black,
                    color = TextPrimary
                )
                Text(
                    text = "Whitelisted administrator email accounts",
                    fontSize = 12.sp,
                    color = TextSecondary
                )
            }

            if (isRoot) {
                Button(
                    onClick = { showAddDialog = true },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                ) {
                    Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Add Admin", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Sub-admin permission notice
        if (!isRoot) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(SurfaceDark)
                    .border(1.dp, CardBorder, RoundedCornerShape(12.dp))
                    .padding(12.dp)
            ) {
                Text(
                    text = "Only Root Super Admin (${AdminRepository.ROOT_SUPERADMIN}) can add or remove sub-administrators.",
                    fontSize = 11.sp,
                    color = TextMuted
                )
            }
        }

        // Admin Accounts List
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(admins, key = { it.email }) { admin ->
                AdminCard(
                    admin = admin,
                    canManage = isRoot && !admin.isRoot,
                    onEditPermissions = { adminToEdit = admin },
                    onDelete = {
                        AdminRepository.removeSubAdmin(admin.email)
                        Toast.makeText(context, "Removed admin access for ${admin.email}", Toast.LENGTH_SHORT).show()
                    }
                )
            }
        }
    }

    // Add Admin Dialog
    if (showAddDialog) {
        var newEmail by remember { mutableStateOf("") }
        var newName by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            containerColor = SurfaceDark,
            title = {
                Text("Authorize New Admin", color = TextPrimary, fontWeight = FontWeight.Bold)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "This email will be whitelisted to sign in to this admin application.",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )
                    OutlinedTextField(
                        value = newEmail,
                        onValueChange = { newEmail = it },
                        label = { Text("Admin Email Address") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        )
                    )
                    OutlinedTextField(
                        value = newName,
                        onValueChange = { newName = it },
                        label = { Text("Display Name / Tag") },
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
                        if (newEmail.isNotBlank()) {
                            val success = AdminRepository.addSubAdmin(newEmail, newName)
                            if (success) {
                                showAddDialog = false
                                Toast.makeText(context, "Added $newEmail to authorized whitelist", Toast.LENGTH_SHORT).show()
                            } else {
                                Toast.makeText(context, "Admin already exists or invalid", Toast.LENGTH_SHORT).show()
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
                ) {
                    Text("Add Admin")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }

    // SuperAdmin Admin Permissions & Delegated Mailboxes Dialog (Matches Website Inventory.jsx:L63-74)
    if (adminToEdit != null) {
        val target = adminToEdit!!
        var allowKeys by remember(target) { mutableStateOf(target.allowLicenseKeys) }
        var selectedGmails by remember(target) { mutableStateOf(target.selectedGmails.toSet()) }
        var selectedZohos by remember(target) { mutableStateOf(target.selectedZohos.toSet()) }
        var selectedImaps by remember(target) { mutableStateOf(target.selectedImaps.toSet()) }
        var isSaving by remember { mutableStateOf(false) }

        val gmails = remember(mailboxes) { mailboxes.filter { it.type == MailboxType.GMAIL } }
        val zohos = remember(mailboxes) { mailboxes.filter { it.type == MailboxType.ZOHO } }
        val imaps = remember(mailboxes) { mailboxes.filter { it.type == MailboxType.IMAP } }

        AlertDialog(
            onDismissRequest = { if (!isSaving) adminToEdit = null },
            containerColor = SurfaceDark,
            title = {
                Column {
                    Text("Delegate Mailboxes & Rights", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text(target.displayName.ifBlank { target.email }, color = CyanAccent, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            },
            text = {
                LazyColumn(
                    modifier = Modifier.heightIn(max = 380.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // License Keys Permission Toggle
                    item {
                        Card(
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = CardDark),
                            border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(CardBorder))
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("License Keys Authority", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = TextPrimary)
                                    Text("Allow generating and managing license keys", fontSize = 10.sp, color = TextSecondary)
                                }
                                Checkbox(
                                    checked = allowKeys,
                                    onCheckedChange = { allowKeys = it },
                                    colors = CheckboxDefaults.colors(checkedColor = IndigoAccent)
                                )
                            }
                        }
                    }

                    // Gmail Mailbox Assignment Section
                    item {
                        Text("ASSIGN GMAIL MAILBOXES (${selectedGmails.size}/${gmails.size})", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFFEF4444))
                    }
                    if (gmails.isEmpty()) {
                        item { Text("No Gmail accounts connected yet.", fontSize = 11.sp, color = TextMuted) }
                    } else {
                        items(gmails) { mb ->
                            val isChecked = selectedGmails.contains(mb.email.lowercase()) || selectedGmails.contains(mb.id)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isChecked) IndigoPrimary.copy(alpha = 0.2f) else CardDark)
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(mb.email, fontSize = 11.sp, color = TextPrimary, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                                Checkbox(
                                    checked = isChecked,
                                    onCheckedChange = { checked ->
                                        selectedGmails = if (checked) selectedGmails + mb.email.lowercase() + mb.id else selectedGmails - mb.email.lowercase() - mb.id
                                    },
                                    colors = CheckboxDefaults.colors(checkedColor = IndigoAccent)
                                )
                            }
                        }
                    }

                    // Zoho Mailbox Assignment Section
                    item {
                        Text("ASSIGN ZOHO MAILBOXES (${selectedZohos.size}/${zohos.size})", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFFC084FC))
                    }
                    if (zohos.isEmpty()) {
                        item { Text("No Zoho accounts connected yet.", fontSize = 11.sp, color = TextMuted) }
                    } else {
                        items(zohos) { mb ->
                            val isChecked = selectedZohos.contains(mb.email.lowercase()) || selectedZohos.contains(mb.id)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isChecked) Color(0xFF581C87).copy(alpha = 0.2f) else CardDark)
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(mb.email, fontSize = 11.sp, color = TextPrimary, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                                Checkbox(
                                    checked = isChecked,
                                    onCheckedChange = { checked ->
                                        selectedZohos = if (checked) selectedZohos + mb.email.lowercase() + mb.id else selectedZohos - mb.email.lowercase() - mb.id
                                    },
                                    colors = CheckboxDefaults.colors(checkedColor = Color(0xFFC084FC))
                                )
                            }
                        }
                    }

                    // IMAP Mailbox Assignment Section
                    item {
                        Text("ASSIGN IMAP MAILBOXES (${selectedImaps.size}/${imaps.size})", fontSize = 11.sp, fontWeight = FontWeight.Black, color = CyanAccent)
                    }
                    if (imaps.isEmpty()) {
                        item { Text("No IMAP accounts connected yet.", fontSize = 11.sp, color = TextMuted) }
                    } else {
                        items(imaps) { mb ->
                            val isChecked = selectedImaps.contains(mb.email.lowercase()) || selectedImaps.contains(mb.id)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isChecked) Color(0xFF0F766E).copy(alpha = 0.2f) else CardDark)
                                    .padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(mb.email, fontSize = 11.sp, color = TextPrimary, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                                Checkbox(
                                    checked = isChecked,
                                    onCheckedChange = { checked ->
                                        selectedImaps = if (checked) selectedImaps + mb.email.lowercase() + mb.id else selectedImaps - mb.email.lowercase() - mb.id
                                    },
                                    colors = CheckboxDefaults.colors(checkedColor = CyanAccent)
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        isSaving = true
                        coroutineScope.launch {
                            val res = AdminRepository.updateAdminPermissions(
                                target,
                                allowKeys,
                                selectedGmails.toList(),
                                selectedZohos.toList(),
                                selectedImaps.toList()
                            )
                            isSaving = false
                            if (res.isSuccess) {
                                Toast.makeText(context, "Saved permissions for ${target.displayName.ifBlank { target.email }}", Toast.LENGTH_SHORT).show()
                                adminToEdit = null
                            } else {
                                Toast.makeText(context, "Error: ${res.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                            }
                        }
                    },
                    enabled = !isSaving,
                    colors = ButtonDefaults.buttonColors(containerColor = IndigoPrimary)
                ) {
                    if (isSaving) {
                        CircularProgressIndicator(modifier = Modifier.size(14.dp), color = Color.White)
                        Spacer(Modifier.width(6.dp))
                    }
                    Text("Save Permissions")
                }
            },
            dismissButton = {
                TextButton(onClick = { adminToEdit = null }, enabled = !isSaving) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }
}

@Composable
fun AdminCard(
    admin: AdminUser,
    canManage: Boolean = false,
    onEditPermissions: () -> Unit = {},
    onDelete: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(CardDark)
            .border(1.dp, if (admin.isRoot) IndigoPrimary.copy(alpha = 0.5f) else CardBorder, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (admin.isRoot) IndigoPrimary else CardBorder),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = admin.email.take(1).uppercase(),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White
                )
            }

            Column {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = admin.displayName.ifBlank { admin.email.substringBefore('@') },
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )

                    if (admin.isRoot) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(IndigoPrimary.copy(alpha = 0.2f))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "ROOT SUPERADMIN",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Black,
                                color = IndigoAccent
                            )
                        }
                    }
                }

                Text(
                    text = admin.email,
                    fontSize = 12.sp,
                    color = TextSecondary
                )
            }
        }

        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            if (canManage) {
                IconButton(onClick = onEditPermissions) {
                    Icon(Icons.Default.Tune, contentDescription = "Manage Permissions", tint = CyanAccent, modifier = Modifier.size(20.dp))
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, contentDescription = "Revoke Admin", tint = RoseAlert.copy(alpha = 0.7f), modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}
