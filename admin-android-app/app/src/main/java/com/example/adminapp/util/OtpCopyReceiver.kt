package com.example.adminapp.util

import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import com.example.adminapp.data.AdminRepository

class OtpCopyReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_COPY_OTP = "com.example.adminapp.ACTION_COPY_OTP"
        const val EXTRA_OTP_CODE = "extra_otp_code"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ACTION_COPY_OTP) {
            val code = intent.getStringExtra(EXTRA_OTP_CODE) ?: return
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("Garena OTP", code)
            clipboard.setPrimaryClip(clip)

            // Find matching OTP in AdminRepository and mark as copied
            val otps = AdminRepository.otpList.value
            val match = otps.find { it.otpCode == code }
            if (match != null) {
                AdminRepository.markOtpCopied(match.id)
            }

            Handler(Looper.getMainLooper()).post {
                Toast.makeText(context, "📋 Copied Garena OTP: $code", Toast.LENGTH_LONG).show()
            }
        }
    }
}
