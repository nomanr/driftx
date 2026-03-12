export const iosAccessibilityFixtures = {
  simpleHierarchy: JSON.stringify({
    "AXElements": [
      {
        "frame": { "x": 0, "y": 0, "width": 393, "height": 852 },
        "role": "AXApplication",
        "label": "MyApp",
        "identifier": "",
        "children": [
          {
            "frame": { "x": 0, "y": 59, "width": 393, "height": 793 },
            "role": "AXWindow",
            "label": "",
            "identifier": "",
            "children": [
              {
                "frame": { "x": 20, "y": 100, "width": 353, "height": 44 },
                "role": "AXButton",
                "label": "Sign In",
                "identifier": "login-button",
                "children": []
              },
              {
                "frame": { "x": 20, "y": 200, "width": 353, "height": 44 },
                "role": "AXTextField",
                "label": "Email",
                "identifier": "email-input",
                "children": []
              }
            ]
          }
        ]
      }
    ]
  }),

  emptyHierarchy: JSON.stringify({ "AXElements": [] }),

  malformed: 'not valid json',
};
