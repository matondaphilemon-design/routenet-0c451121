package com.example.yourapp

import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.Manifest
import android.content.pm.PackageManager
import android.widget.Toast
import java.io.File
import java.io.FileOutputStream

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var musicService: MusicService? = null
    private var bound = false

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as? MusicService.LocalBinder
            musicService = binder?.service
            bound = true
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            musicService = null
            bound = false
        }
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        setupWebView()
        startForegroundService(Intent(this, MusicService::class.java))
        bindService(Intent(this, MusicService::class.java), connection, Context.BIND_AUTO_CREATE)
        requestPermissionsIfNeeded()
    }

    private fun setupWebView() {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.settings.allowFileAccess = true
        webView.settings.allowContentAccess = true
        webView.settings.databaseEnabled = true
        webView.settings.setSupportZoom(false)
        webView.settings.builtInZoomControls = false
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                webView.evaluateJavascript("window.__musicBridgeReady = true;", null)
            }
        }

        webView.addJavascriptInterface(WebAppBridge(), "AndroidMusicBridge")

        val assetPath = "file:///android_asset/webapp/index.html"
        val file = File(filesDir, "webapp/index.html")
        if (file.exists()) {
            webView.loadUrl("file://${file.absolutePath}")
        } else {
            copyWebAppFromAssets()
            webView.loadUrl(assetPath)
        }
    }

    private fun copyWebAppFromAssets() {
        val assetManager = assets
        val webDir = File(filesDir, "webapp")
        if (!webDir.exists()) webDir.mkdirs()
        copyAssetFolder(assetManager, "webapp", webDir)
    }

    private fun copyAssetFolder(assetManager: android.content.res.AssetManager, sourcePath: String, destinationDir: File) {
        val entries = assetManager.list(sourcePath) ?: return
        if (entries.isEmpty()) {
            val inputStream = assetManager.open(sourcePath)
            val outputFile = File(destinationDir, sourcePath.substringAfterLast('/'))
            outputFile.parentFile?.mkdirs()
            val outputStream = FileOutputStream(outputFile)
            inputStream.copyTo(outputStream)
            inputStream.close()
            outputStream.close()
            return
        }

        val targetDir = File(destinationDir, sourcePath.substringAfterLast('/'))
        if (!targetDir.exists()) {
            targetDir.mkdirs()
        }

        for (entry in entries) {
            copyAssetFolder(assetManager, "$sourcePath/$entry", targetDir)
        }
    }

    private fun requestPermissionsIfNeeded() {
        val permissions = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.READ_EXTERNAL_STORAGE)
        } else {
            permissions.add(Manifest.permission.READ_MEDIA_AUDIO)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
        }
        val missing = permissions.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), 1001)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 1001) {
            Toast.makeText(this, "Permissions updated", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroy() {
        if (bound) {
            unbindService(connection)
        }
        super.onDestroy()
    }

    inner class WebAppBridge {
        @JavascriptInterface
        fun play(url: String, title: String, artist: String, artwork: String) {
            musicService?.play(url, title, artist, artwork)
        }

        @JavascriptInterface
        fun pause() {
            musicService?.pause()
        }

        @JavascriptInterface
        fun resume() {
            musicService?.resume()
        }

        @JavascriptInterface
        fun seekTo(position: Long) {
            musicService?.seekTo(position)
        }

        @JavascriptInterface
        fun getCurrentPosition(): Long {
            return musicService?.getCurrentPosition() ?: 0L
        }

        @JavascriptInterface
        fun getDuration(): Long {
            return musicService?.getDuration() ?: 0L
        }

        @JavascriptInterface
        fun setPlaybackSpeed(speed: Float) {
            musicService?.setPlaybackSpeed(speed)
        }

        @JavascriptInterface
        fun updateMetadata(title: String, artist: String, artwork: String) {
            musicService?.updateMetadata(title, artist, artwork)
        }

        @JavascriptInterface
        fun stop() {
            musicService?.stopPlayback()
        }
    }
}
