package com.example.yourapp

import android.content.Context
import android.support.v4.media.session.MediaSessionCompat
import androidx.media3.common.Player
import androidx.media3.session.MediaSession

class MediaSessionManager(context: Context, player: Player) {
    private val mediaSession = MediaSession.Builder(context, player as androidx.media3.common.Player).build()

    fun release() {
        mediaSession.release()
    }
}
