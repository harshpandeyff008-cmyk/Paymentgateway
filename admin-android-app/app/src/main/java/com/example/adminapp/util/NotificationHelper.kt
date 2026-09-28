package com.example.adminapp.util

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.example.adminapp.MainActivity
import com.example.adminapp.R

object NotificationHelper {

    const val CHANNEL_OTP_ID = "garena_otp_channel"
    const val CHANNEL_OTP_NAME = "Garena OTP Alerts"

    const val CHANNEL_CHAT_ID = "support_chat_channel"
    const val CHANNEL_CHAT_NAME = "Support Chat Messages"

    fun initChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // 1. High Priority Garena OTP Channel
            val otpChannel = NotificationChannel(
                CHANNEL_OTP_ID,
                CHANNEL_OTP_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Urgent 8-digit verification codes for Garena account logins"
                enableLights(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 100, 250)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(otpChannel)

            // 2. High Priority Support Chat Channel
            val chatChannel = NotificationChannel(
                CHANNEL_CHAT_ID,
                CHANNEL_CHAT_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Instant notifications when clients send support or escrow messages"
                enableLights(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 150, 100, 150)
                setShowBadge(true)
            }
            notificationManager.createNotificationChannel(chatChannel)
        }
    }

    fun showOtpNotification(context: Context, otpCode: String, mailbox: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return
            }
        }

        try {
            // Haptic trigger
            triggerHapticFeedback(context, isUrgent = true)

            // Intent to launch app when notification clicked
            val openAppIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("navigate_to", "otp")
            }
            val openAppPendingIntent = PendingIntent.getActivity(
                context,
                0,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Direct 1-tap "COPY OTP" Broadcast action
            val copyIntent = Intent(context, OtpCopyReceiver::class.java).apply {
                action = OtpCopyReceiver.ACTION_COPY_OTP
                putExtra(OtpCopyReceiver.EXTRA_OTP_CODE, otpCode)
            }
            val copyPendingIntent = PendingIntent.getBroadcast(
                context,
                otpCode.hashCode(),
                copyIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            val bigText = StringBuilder()
                .append("Your Garena 8-digit verification code is:\n\n")
                .append("▶  $otpCode  ◀\n\n")
                .append("Target Mailbox: $mailbox\n")
                .append("Tap 'COPY OTP' to copy code directly without leaving your current app.")
                .toString()

            val notification = NotificationCompat.Builder(context, CHANNEL_OTP_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .setContentTitle("🔥 GARENA OTP: $otpCode")
                .setContentText("Code: $otpCode • $mailbox")
                .setStyle(
                    NotificationCompat.BigTextStyle()
                        .setBigContentTitle("🔥 GARENA VERIFICATION CODE: $otpCode")
                        .bigText(bigText)
                        .setSummaryText("Garena Security")
                )
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(openAppPendingIntent)
                .addAction(
                    android.R.drawable.ic_menu_save,
                    "📋 COPY OTP ($otpCode)",
                    copyPendingIntent
                )
                .setAutoCancel(true)
                .setSound(soundUri)
                .setVibrate(longArrayOf(0, 300, 150, 300))
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .build()

            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val notifId = (System.currentTimeMillis() % 100000).toInt() + 1000
            notificationManager.notify(notifId, notification)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun showSupportChatNotification(context: Context, clientName: String, messageText: String, clientUid: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return
            }
        }

        try {
            triggerHapticFeedback(context, isUrgent = false)

            val openAppIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("navigate_to", "support_chat")
                putExtra("client_uid", clientUid)
            }
            val openPendingIntent = PendingIntent.getActivity(
                context,
                clientUid.hashCode(),
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(context, CHANNEL_CHAT_ID)
                .setSmallIcon(android.R.drawable.stat_notify_chat)
                .setContentTitle("💬 Support Chat: $clientName")
                .setContentText(messageText)
                .setStyle(
                    NotificationCompat.BigTextStyle()
                        .setBigContentTitle("💬 $clientName (Client Support)")
                        .bigText(messageText)
                        .setSummaryText("Client Support Desk")
                )
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(openPendingIntent)
                .setAutoCancel(true)
                .build()

            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val notifId = clientUid.hashCode()
            notificationManager.notify(notifId, notification)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun triggerHapticFeedback(context: Context, isUrgent: Boolean) {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val effect = if (isUrgent) {
                    VibrationEffect.createWaveform(longArrayOf(0, 200, 100, 250), -1)
                } else {
                    VibrationEffect.createOneShot(120, VibrationEffect.DEFAULT_AMPLITUDE)
                }
                vibrator?.vibrate(effect)
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(if (isUrgent) 300 else 100)
            }
        } catch (e: Exception) {}
    }
}
