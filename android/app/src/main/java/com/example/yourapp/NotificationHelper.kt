package com.example.yourapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.media.app.NotificationCompat as MediaNotificationCompat

class NotificationHelper(private val context: Context) {

    private val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    init {
        createChannel()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Music Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Playback controls"
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun buildNotification(context: Context, title: String, artist: String, artworkUrl: String, isPlaying: Boolean): Notification {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val playPauseIntent = PendingIntent.getService(
            context,
            1,
            Intent(context, MusicService::class.java).apply { action = ACTION_TOGGLE_PLAYBACK },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val nextIntent = PendingIntent.getService(
            context,
            2,
            Intent(context, MusicService::class.java).apply { action = ACTION_NEXT },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val prevIntent = PendingIntent.getService(
            context,
            3,
            Intent(context, MusicService::class.java).apply { action = ACTION_PREVIOUS },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val bitmap = BitmapFactory.decodeResource(context.resources, R.drawable.ic_music)
        val playPauseIcon = if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play
        val playPauseLabel = if (isPlaying) "Pause" else "Play"

        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_music)
            .setContentTitle(title.ifBlank { "Now Playing" })
            .setContentText(artist.ifBlank { "" })
            .setLargeIcon(bitmap)
            .setContentIntent(pendingIntent)
            .setDeleteIntent(PendingIntent.getService(context, 4, Intent(context, MusicService::class.java).apply { action = ACTION_STOP }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .addAction(R.drawable.ic_skip_previous, "Previous", prevIntent)
            .addAction(playPauseIcon, playPauseLabel, playPauseIntent)
            .addAction(R.drawable.ic_skip_next, "Next", nextIntent)
            .build()
    }

    fun updateNotification(context: Context, title: String, artist: String, artworkUrl: String, isPlaying: Boolean) {
        val notification = buildNotification(context, title, artist, artworkUrl, isPlaying).apply {
            flags = Notification.FLAG_ONGOING_EVENT
        }
        NotificationManagerCompat.from(context).notify(MusicService.NOTIFICATION_ID, notification)
    }

    companion object {
        const val CHANNEL_ID = "music_channel"
        const val ACTION_TOGGLE_PLAYBACK = "com.example.yourapp.TOGGLE_PLAYBACK"
        const val ACTION_NEXT = "com.example.yourapp.NEXT"
        const val ACTION_PREVIOUS = "com.example.yourapp.PREVIOUS"
        const val ACTION_STOP = "com.example.yourapp.STOP"
    }
}
