package com.example.adminapp

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.example.adminapp.data.AdminRepository
import com.example.adminapp.theme.AdminAppTheme
import com.example.adminapp.ui.AdminAppScaffold
import com.example.adminapp.ui.screens.LoginScreen

class MainActivity : ComponentActivity() {

    companion object {
        const val CHANNEL_ID = "garena_otp_channel"
        const val CHANNEL_NAME = "Garena OTP Alerts"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AdminRepository.init(applicationContext)
        enableEdgeToEdge()
        createNotificationChannel()

        setContent {
            AdminAppTheme {
                // Request POST_NOTIFICATIONS immediately upon app launch
                val permissionLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.RequestPermission()
                ) { isGranted ->
                    AdminRepository.notificationPermissionGranted.value = isGranted
                }

                LaunchedEffect(Unit) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        val hasPermission = ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.POST_NOTIFICATIONS
                        ) == PackageManager.PERMISSION_GRANTED

                        if (!hasPermission) {
                            permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        } else {
                            AdminRepository.notificationPermissionGranted.value = true
                        }
                    } else {
                        AdminRepository.notificationPermissionGranted.value = true
                    }
                }

                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val currentUser by AdminRepository.currentUser.collectAsState()
                    if (currentUser == null) {
                        LoginScreen(onLoginSuccess = { /* Updates StateFlow automatically */ })
                    } else {
                        AdminAppScaffold(onLogout = { AdminRepository.logout() })
                    }
                }
            }
        }
    }

    private fun createNotificationChannel() {
        com.example.adminapp.util.NotificationHelper.initChannels(applicationContext)
    }
}
