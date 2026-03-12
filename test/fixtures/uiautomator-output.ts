export const uiautomatorFixtures = {
  simpleHierarchy: `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.example.app" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][1080,2400]">
    <node index="0" text="" resource-id="android:id/content" class="android.widget.FrameLayout" package="com.example.app" bounds="[0,48][1080,2400]">
      <node index="0" text="" resource-id="com.example.app:id/main_container" class="android.widget.LinearLayout" package="com.example.app" bounds="[0,48][1080,2400]">
        <node index="0" text="Sign In" resource-id="com.example.app:id/btnLogin" class="android.widget.Button" package="com.example.app" content-desc="Login button" clickable="true" enabled="true" bounds="[63,1626][1017,1752]"/>
        <node index="1" text="Enter email" resource-id="com.example.app:id/emailInput" class="android.widget.EditText" package="com.example.app" clickable="true" enabled="true" bounds="[50,400][1030,500]"/>
        <node index="2" text="Password" resource-id="com.example.app:id/passwordInput" class="android.widget.EditText" package="com.example.app" password="true" bounds="[50,520][1030,620]"/>
      </node>
    </node>
  </node>
</hierarchy>`,

  reactNativeHierarchy: `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.chptr" bounds="[0,0][1080,2400]">
    <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.chptr" bounds="[0,0][1080,2400]">
      <node index="0" text="" resource-id="" class="com.facebook.react.ReactRootView" package="com.chptr" bounds="[0,0][1080,2400]">
        <node index="0" text="My Chptr" resource-id="" class="android.widget.TextView" package="com.chptr" bounds="[36,147][350,195]"/>
        <node index="1" text="" resource-id="header-avatar" class="android.widget.ImageView" package="com.chptr" content-desc="Profile avatar" bounds="[36,250][180,394]"/>
        <node index="2" text="Announcements" resource-id="announcements-section" class="android.view.ViewGroup" package="com.chptr" bounds="[0,490][1080,920]">
          <node index="0" text="PN test" resource-id="" class="android.widget.TextView" package="com.chptr" bounds="[72,555][580,605]"/>
          <node index="1" text="SEE ALL" resource-id="see-all-announcements" class="android.widget.TextView" package="com.chptr" clickable="true" bounds="[750,490][1044,540]"/>
        </node>
      </node>
    </node>
  </node>
</hierarchy>`,

  emptyHierarchy: `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.example.app" bounds="[0,0][1080,2400]"/>
</hierarchy>`,

  malformedXml: `not valid xml at all`,

  noNodes: `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
</hierarchy>`,
};
