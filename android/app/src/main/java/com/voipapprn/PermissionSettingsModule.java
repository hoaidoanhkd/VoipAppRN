package com.voipapprn;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class PermissionSettingsModule extends ReactContextBaseJavaModule {
    private static final String TAG = "PermissionSettings";
    private final ReactApplicationContext reactContext;

    public PermissionSettingsModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "PermissionSettings";
    }

    @ReactMethod
    public void openAppPermissions(Promise promise) {
        try {
            // Open App Details Settings (this is the best we can do for regular apps)
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", reactContext.getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            Log.d(TAG, "Opening app details for: " + reactContext.getPackageName());
            reactContext.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error opening settings: " + e.getMessage());
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void openAppDetails(Promise promise) {
        openAppPermissions(promise);
    }
}
