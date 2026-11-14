package pl.radarepwr.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.google.firebase.FirebaseApp;

/**
 * Radar EPWR – powłoka aplikacji. Treść to strona https://radar-epwr.pl/app/ (Capacitor), tu tylko:
 *  - utwardzenie WebView (bez dostępu do plików urządzenia),
 *  - WebView zostaje WYŁĄCZNIE na ekranie https://radar-epwr.pl/app/ – każdy inny adres (także inne strony radar-epwr.pl,
 *    np. strona główna ze skryptami partnerów) otwiera się w przeglądarce, więc most natywny nie trafia do obcego kodu,
 *  - mały, jawny interfejs „RadarNative” dla strony: czy Firebase jest skonfigurowany (bez google-services.json
 *    wywołanie wtyczki powiadomień kończyłoby się błędem) oraz otwarcie systemowych ustawień powiadomień.
 *    Interfejs nie przyjmuje żadnych danych od strony – tylko zwraca wartość logiczną albo otwiera ekran ustawień.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv == null) return;
        WebSettings s = wv.getSettings();
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setGeolocationEnabled(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        wv.addJavascriptInterface(new RadarNative(), "RadarNative");
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (req.isForMainFrame() && u != null && "radar-epwr.pl".equals(u.getHost())) {
                    String path = u.getPath() == null ? "" : u.getPath();
                    if (!"https".equals(u.getScheme()) || !(path.equals("/app/") || path.equals("/app/index.html"))) {
                        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Throwable t) { /* brak przeglądarki */ }
                        return true;
                    }
                }
                return super.shouldOverrideUrlLoading(view, req);
            }
        });
    }

    final class RadarNative {
        @JavascriptInterface
        public boolean fcmReady() {
            try {
                return !FirebaseApp.getApps(MainActivity.this).isEmpty();
            } catch (Throwable t) {
                return false;
            }
        }

        @JavascriptInterface
        public void openNotificationSettings() {
            runOnUiThread(() -> {
                try {
                    Intent i;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                                .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                    } else {
                        i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                                .setData(android.net.Uri.parse("package:" + getPackageName()));
                    }
                    startActivity(i);
                } catch (Throwable t) {
                    // brak ekranu ustawień – nic nie robimy
                }
            });
        }
    }
}
