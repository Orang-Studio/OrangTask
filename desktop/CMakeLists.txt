cmake_minimum_required(VERSION 3.21)

project(orangtask VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

include(GNUInstallDirs)

find_package(Qt6 6.4 REQUIRED COMPONENTS
    Core Gui Widgets Qml Quick QuickControls2 Svg Sql Network WebSockets DBus)
find_package(Qt6 6.4 OPTIONAL_COMPONENTS Test)

qt_standard_project_setup()

# tokens go to the Secret Service KWallet on Plasma when QtKeychain is available
find_package(Qt6Keychain QUIET)
# layer shell lets the tray popup and sticky note anchor to screen edges on Wayland
find_package(LayerShellQt 6.6 QUIET)  # 6.6: Window::setScreen

option(ORANGTASK_BUILD_TESTS "Build unit tests" ON)

# the web apps translation catalogs are the source of truth desktop only strings live in desktop i18n and are merged on top at runtime
set(WEB_I18N_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../frontend/src/lib/i18n")

set(CORE_SOURCES
    src/core/ApiClient.cpp
    src/core/AuthManager.cpp
    src/core/Database.cpp
    src/core/Format.cpp
    src/core/I18n.cpp
    src/core/OfflineQueue.cpp
    src/core/QuickAddParser.cpp
    src/core/RealtimeClient.cpp
    src/core/Settings.cpp
    src/core/Store.cpp
    src/core/SyncEngine.cpp
    src/core/TokenStore.cpp
    src/models/JsonListModel.cpp
    src/models/ListModel.cpp
    src/models/ScratchpadModel.cpp
    src/models/TaskModel.cpp
)

add_library(orangtask_core STATIC ${CORE_SOURCES})
target_include_directories(orangtask_core PUBLIC src)
target_link_libraries(orangtask_core PUBLIC
    Qt6::Core Qt6::Gui Qt6::Qml Qt6::Sql Qt6::Network Qt6::WebSockets)
target_compile_definitions(orangtask_core PUBLIC ORANGTASK_VERSION="${PROJECT_VERSION}")
if(Qt6Keychain_FOUND)
    target_link_libraries(orangtask_core PUBLIC qt6keychain)
    target_compile_definitions(orangtask_core PUBLIC HAVE_KEYCHAIN)
endif()

qt_add_resources(orangtask_core "i18n"
    PREFIX "/i18n"
    BASE "${WEB_I18N_DIR}"
    FILES "${WEB_I18N_DIR}/en.json" "${WEB_I18N_DIR}/lt.json")
qt_add_resources(orangtask_core "i18n_desktop"
    PREFIX "/i18n/desktop"
    BASE i18n
    FILES i18n/en.json i18n/lt.json)

qt_add_executable(orangtask
    src/main.cpp
    src/app/AppController.cpp
    src/app/Screenshots.cpp
    src/app/DBusInterface.cpp
    src/core/IconProvider.cpp
    src/system/Autostart.cpp
    src/system/KRunner.cpp
    src/system/Notifier.cpp
    src/system/ReminderScheduler.cpp
    src/system/TrayController.cpp
    src/system/WindowPlacer.cpp
    src/system/KWin.cpp
)

set_source_files_properties(qml/Theme.qml qml/Tr.qml qml/Views.qml PROPERTIES QT_QML_SINGLETON_TYPE TRUE)

file(GLOB ICON_FILES RELATIVE "${CMAKE_CURRENT_SOURCE_DIR}" assets/icons/lucide/*.svg)
file(GLOB FONT_FILES RELATIVE "${CMAKE_CURRENT_SOURCE_DIR}" assets/fonts/*.ttf)

qt_add_qml_module(orangtask
    URI OrangTask
    VERSION 1.0
    RESOURCE_PREFIX /qt/qml
    QML_FILES
        qml/Theme.qml
        qml/Tr.qml
        qml/Views.qml
        qml/Main.qml
        qml/controls/Avatar.qml
        qml/controls/ChoiceChip.qml
        qml/controls/Chip.qml
        qml/controls/DatePicker.qml
        qml/controls/HoldToReorder.qml
        qml/controls/EmptyState.qml
        qml/controls/Icon.qml
        qml/controls/IconButton.qml
        qml/controls/Logo.qml
        qml/controls/OButton.qml
        qml/controls/OCheckbox.qml
        qml/controls/ODialog.qml
        qml/controls/OInput.qml
        qml/controls/OMenu.qml
        qml/controls/OMenuItem.qml
        qml/controls/OScrollBar.qml
        qml/controls/OSelect.qml
        qml/controls/OSwitch.qml
        qml/controls/OTextArea.qml
        qml/controls/PriorityDot.qml
        qml/controls/Toast.qml
        qml/pages/CommandPalette.qml
        qml/pages/ListEditor.qml
        qml/pages/NewListDialog.qml
        qml/pages/LoginPage.qml
        qml/pages/NotificationsPage.qml
        qml/pages/PinPage.qml
        qml/pages/QuickAddBar.qml
        qml/pages/RecurrencePicker.qml
        qml/pages/ScratchpadsPage.qml
        qml/pages/SettingsPage.qml
        qml/pages/ShareDialog.qml
        qml/pages/ShortcutsDialog.qml
        qml/pages/Sidebar.qml
        qml/pages/TaskDelegate.qml
        qml/pages/TaskDetail.qml
        qml/pages/TaskListPage.qml
        qml/popup/TrayPopup.qml
        qml/popup/PopupRow.qml
        qml/popup/QuickAddWindow.qml
        qml/popup/StickyNote.qml
    RESOURCES
        assets/logo.svg
        assets/google.svg
        assets/mascot.svg
        ${ICON_FILES}
        ${FONT_FILES}
)

target_link_libraries(orangtask PRIVATE
    orangtask_core Qt6::Widgets Qt6::Quick Qt6::QuickControls2 Qt6::Svg Qt6::DBus)

if(LayerShellQt_FOUND)
    target_link_libraries(orangtask PRIVATE LayerShellQt::Interface)
    target_compile_definitions(orangtask PRIVATE HAVE_LAYERSHELL)
endif()

install(TARGETS orangtask RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
install(FILES data/lt.oranges.orangtask.desktop DESTINATION ${CMAKE_INSTALL_DATADIR}/applications)
# refresh mimeinfo cache so browsers resolve orangtask links
install(CODE "if(NOT \"\$ENV{DESTDIR}\")
    execute_process(COMMAND update-desktop-database \"${CMAKE_INSTALL_FULL_DATADIR}/applications\")
endif()")
# d Bus activation needs the absolute binary path the others carry the version
foreach(tmpl plasma-runner-orangtask.desktop lt.oranges.orangtask.service lt.oranges.orangtask.metainfo.xml)
    configure_file(data/${tmpl}.in ${CMAKE_CURRENT_BINARY_DIR}/data/${tmpl} @ONLY)
endforeach()
install(FILES ${CMAKE_CURRENT_BINARY_DIR}/data/plasma-runner-orangtask.desktop DESTINATION ${CMAKE_INSTALL_DATADIR}/krunner/dbusplugins)
install(FILES ${CMAKE_CURRENT_BINARY_DIR}/data/lt.oranges.orangtask.service DESTINATION ${CMAKE_INSTALL_DATADIR}/dbus-1/services)
install(FILES ${CMAKE_CURRENT_BINARY_DIR}/data/lt.oranges.orangtask.metainfo.xml DESTINATION ${CMAKE_INSTALL_DATADIR}/metainfo)
install(FILES data/icons/lt.oranges.orangtask.svg DESTINATION ${CMAKE_INSTALL_DATADIR}/icons/hicolor/scalable/apps)
install(FILES data/icons/lt.oranges.orangtask.png DESTINATION ${CMAKE_INSTALL_DATADIR}/icons/hicolor/512x512/apps)

if(ORANGTASK_BUILD_TESTS AND TARGET Qt6::Test)
    enable_testing()
    add_subdirectory(tests)
endif()

message(STATUS "QtKeychain: ${Qt6Keychain_FOUND}  LayerShellQt: ${LayerShellQt_FOUND}")
