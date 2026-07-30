package com.example.yourapp

import android.app.Notification
import android.content.Intent
import android.os.Binder
import android.os.IBinder
import androidx.lifecycle.LifecycleService
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer

class MusicService : LifecycleService() {

    private val binder = LocalBinder()
    private var player: ExoPlayer? = null
    private var mediaSessionManager: MediaSessionManager? = null
    private var notificationHelper: NotificationHelper? = null
    private var audioFocusManager: AudioFocusManager? = null
    private var currentTitle = ""
    private var currentArtist = ""
    private var currentArtworkUrl = ""

    inner class LocalBinder : Binder() {
        val service: MusicService
            get() = this@MusicService
    }

    override fun onCreate() {
        super.onCreate()
        initializePlayer()
        notificationHelper = NotificationHelper(this)
        audioFocusManager = AudioFocusManager(this)
        startForeground(NOTIFICATION_ID, notificationHelper!!.buildNotification(this, "", "", "", false))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        intent?.action?.let { handleAction(it) }
        return START_STICKY
    }

    override fun onBind(intent: Intent): IBinder = binder

    private fun initializePlayer() {
        player = ExoPlayer.Builder(this).build().also {
            it.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                true
            )
            it.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY || playbackState == Player.STATE_BUFFERING) {
                        notificationHelper?.updateNotification(this@MusicService, currentTitle, currentArtist, currentArtworkUrl, player?.isPlaying == true)
                    }
                }

                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    notificationHelper?.updateNotification(this@MusicService, currentTitle, currentArtist, currentArtworkUrl, isPlaying)
                }
            })
        }
        mediaSessionManager = MediaSessionManager(this, player!!)
    }

    private fun handleAction(action: String) {
        when (action) {
            NotificationHelper.ACTION_TOGGLE_PLAYBACK -> {
                if (player?.isPlaying == true) pause() else resume()
            }
            NotificationHelper.ACTION_NEXT -> {
                player?.seekToNextMediaItem()
            }
            NotificationHelper.ACTION_PREVIOUS -> {
                player?.seekToPreviousMediaItem()
            }
            NotificationHelper.ACTION_STOP -> {
                stopPlayback()
            }
        }
    }

    fun play(url: String, title: String, artist: String, artwork: String) {
        currentTitle = title
        currentArtist = artist
        currentArtworkUrl = artwork
        val mediaItem = MediaItem.fromUri(url)
        player?.setMediaItem(mediaItem)
        player?.prepare()
        if (audioFocusManager?.requestFocus() == true) {
            player?.play()
        }
        notificationHelper?.updateNotification(this, title, artist, artwork, true)
    }

    fun pause() {
        player?.pause()
        audioFocusManager?.abandonFocus()
        notificationHelper?.updateNotification(this, currentTitle, currentArtist, currentArtworkUrl, false)
    }

    fun resume() {
        player?.play()
        notificationHelper?.updateNotification(this, currentTitle, currentArtist, currentArtworkUrl, true)
    }

    fun seekTo(position: Long) {
        player?.seekTo(position)
    }

    fun getCurrentPosition(): Long = player?.currentPosition ?: 0L

    fun getDuration(): Long = player?.duration ?: 0L

    fun setPlaybackSpeed(speed: Float) {
        player?.setPlaybackSpeed(speed)
    }

    fun updateMetadata(title: String, artist: String, artwork: String) {
        currentTitle = title
        currentArtist = artist
        currentArtworkUrl = artwork
        notificationHelper?.updateNotification(this, title, artist, artwork, player?.isPlaying == true)
    }

    fun stopPlayback() {
        player?.stop()
        audioFocusManager?.abandonFocus()
        notificationHelper?.updateNotification(this, currentTitle, currentArtist, currentArtworkUrl, false)
    }

    override fun onDestroy() {
        mediaSessionManager?.release()
        audioFocusManager?.abandonFocus()
        player?.release()
        super.onDestroy()
    }

    companion object {
        const val NOTIFICATION_ID = 1001
    }
}
