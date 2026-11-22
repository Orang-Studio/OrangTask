pragma Singleton
import QtQuick
import OrangTask.Core

QtObject {
    id: theme

    readonly property color orange50: "#fff7ed"
    readonly property color orange100: "#ffedd5"
    readonly property color orange200: "#fed7aa"
    readonly property color orange300: "#fdba74"
    readonly property color orange400: "#fb923c"
    readonly property color orange500: "#f97316"
    readonly property color orange600: "#ea580c"
    readonly property color orange700: "#c2410c"
    readonly property color orange950: "#431407"

    readonly property color ink900: "#0f0f0f"
    readonly property color ink850: "#141414"
    readonly property color ink800: "#161616"
    readonly property color ink750: "#1c1c1c"
    readonly property color ink700: "#222222"
    readonly property color ink600: "#2a2a2a"
    readonly property color ink500: "#333333"
    readonly property color ink400: "#444444"

    readonly property color gray50: "#f9fafb"
    readonly property color gray100: "#f3f4f6"
    readonly property color gray200: "#e5e7eb"
    readonly property color gray300: "#d1d5db"
    readonly property color gray400: "#9ca3af"
    readonly property color gray500: "#6b7280"
    readonly property color gray600: "#4b5563"

    readonly property color red500: "#ef4444"
    readonly property color red600: "#dc2626"
    readonly property color green500: "#22c55e"

    readonly property var listColors: ["#f97316", "#ef4444", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280"]
    readonly property var listIcons: ["hash", "inbox", "briefcase", "home", "star", "heart", "cart", "list", "checks",
        "calendar", "book", "code", "music", "camera", "coffee", "zap", "flag", "bell", "bookmark", "folder", "file",
        "tag", "dollar", "gift", "plane", "car", "dumbbell", "graduation", "lightbulb", "leaf", "sun", "moon", "cloud",
        "pizza", "game", "wrench", "palette", "target", "trophy", "users", "phone", "mail", "map", "shield", "smile",
        "paw", "rocket", "webhook", "github"]

    property SystemPalette systemPalette: SystemPalette { colorGroup: SystemPalette.Active }
    readonly property bool systemDark: {
        // qt 6 5 reports the colour scheme directly 6 4 falls back to the palette
        const scheme = Qt.styleHints.colorScheme
        if (scheme !== undefined && scheme !== 0)
            return scheme === 2
        return systemPalette.window.hslLightness < 0.5
    }
    readonly property bool dark: AppSettings.theme === "dark" || (AppSettings.theme !== "light" && systemDark)

    readonly property color bg: dark ? ink800 : "#f5f5f5"
    readonly property color sidebar: dark ? ink900 : "#ffffff"
    readonly property color surface: dark ? ink800 : "#ffffff"
    readonly property color surfaceRaised: dark ? ink750 : "#ffffff"
    readonly property color hover: dark ? ink750 : gray50
    readonly property color selected: dark ? ink750 : orange50
    readonly property color border: dark ? ink700 : gray200
    readonly property color borderStrong: dark ? ink600 : gray300
    readonly property color text: dark ? "#ffffff" : ink800
    readonly property color textMuted: dark ? gray400 : gray500
    readonly property color textFaint: dark ? "#6b6b6b" : gray400
    readonly property color inputBg: dark ? ink750 : "#ffffff"
    readonly property color inputBorder: dark ? ink500 : gray300
    readonly property color secondaryBg: dark ? ink700 : "#ffffff"
    readonly property color secondaryHover: dark ? ink600 : gray100
    readonly property color secondaryText: dark ? "#ffffff" : "#000000"
    readonly property color badgeBg: dark ? ink700 : gray100
    readonly property color badgeText: dark ? gray400 : gray600
    readonly property color overdueBg: dark ? "#450a0a" : "#fee2e2"
    readonly property color overdueText: dark ? "#f87171" : "#b91c1c"
    readonly property color tagBg: dark ? orange950 : orange100
    readonly property color tagText: dark ? orange400 : orange700
    readonly property color scrollThumb: ink500
    readonly property color scrim: Qt.rgba(0, 0, 0, dark ? 0.6 : 0.4)
    readonly property color accent: orange500
    readonly property color accentHover: orange600

    function priorityColor(p) {
        return p === "high" ? red500 : p === "medium" ? "#eab308" : p === "low" ? "#3b82f6" : gray500
    }

    readonly property string fontFamily: "DM Sans"
    readonly property int fontXs: 12
    readonly property int fontSm: 14
    readonly property int fontBase: 15
    readonly property int fontLg: 18
    readonly property int fontXl: 20
    readonly property int font2xl: 24

    readonly property int radiusInput: 4
    readonly property int controlHeight: 44
    readonly property int controlHeightSm: 36

    readonly property int slideIn: 200
    readonly property int slideUp: 250
    readonly property int scaleCheck: 300
    readonly property int fadeOut: 300
    readonly property int hoverMs: 120

    function icon(name, color) {
        return "image://icon/" + (name || "list") + "?color=" + encodeURIComponent(String(color))
    }
}
