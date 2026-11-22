package lt.oranges.orangtask.home

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Layers
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.WbSunny
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import lt.oranges.orangtask.ui.components.OrangSnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import lt.oranges.orangtask.core.i18n.tr
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleStartEffect
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import lt.oranges.orangtask.R
import lt.oranges.orangtask.core.i18n.AppStrings
import lt.oranges.orangtask.core.network.UserDto
import lt.oranges.orangtask.core.sync.SyncCoordinator
import lt.oranges.orangtask.lists.ListsScreen
import lt.oranges.orangtask.lists.ListsViewModel
import lt.oranges.orangtask.lists.NewListDialog
import lt.oranges.orangtask.notifications.NotificationsScreen
import lt.oranges.orangtask.scratchpads.ScratchpadsScreen
import lt.oranges.orangtask.search.SearchScreen
import lt.oranges.orangtask.settings.SettingsScreen
import lt.oranges.orangtask.tasks.TaskListScreen
import lt.oranges.orangtask.tasks.UndoableTaskDeleteViewModel
import lt.oranges.orangtask.ui.components.isDarkTheme
import lt.oranges.orangtask.ui.components.rememberHaptics
import lt.oranges.orangtask.ui.theme.Ink700
import lt.oranges.orangtask.ui.theme.Ink850
import lt.oranges.orangtask.ui.theme.Orange500
import javax.inject.Inject

@HiltViewModel
class SyncViewModel @Inject constructor(
    private val sync: SyncCoordinator,
) : ViewModel() {
    fun start() = sync.start()
    fun stop() = sync.stop()

    override fun onCleared() {
        sync.stop()
    }
}

internal fun isMainMenuRoute(route: String?): Boolean = when (route) {
    "view/{kind}", "lists", "search", "settings" -> true
    else -> false
}

internal enum class MainTab { TODAY, LISTS, SEARCH, SETTINGS }

internal fun mainTabForRoute(route: String?): MainTab? = when {
    route == "view/{kind}" -> MainTab.TODAY
    route == "lists" || route == "scratchpads" || route?.startsWith("list/") == true -> MainTab.LISTS
    route == "search" -> MainTab.SEARCH
    route == "settings" -> MainTab.SETTINGS
    else -> null
}

internal fun disablesTabTransition(initialRoute: String?, targetRoute: String?): Boolean {
    if (isMainMenuRoute(initialRoute) && isMainMenuRoute(targetRoute)) return true

    val initialTab = mainTabForRoute(initialRoute)
    val targetTab = mainTabForRoute(targetRoute)
    return initialTab != null && targetTab != null && initialTab != targetTab
}

@Composable
fun MainScaffold(user: UserDto?, onLogout: () -> Unit, onUserChanged: () -> Unit = {}) {
    val navController = rememberNavController()
    val syncViewModel: SyncViewModel = hiltViewModel()
    val taskDeleteViewModel: UndoableTaskDeleteViewModel = hiltViewModel()
    val haptics = rememberHaptics()
    val snackbar = remember { SnackbarHostState() }

    LifecycleStartEffect(Unit) {
        syncViewModel.start()
        onStopOrDispose { syncViewModel.stop() }
    }

    val context = LocalContext.current
    LaunchedEffect(taskDeleteViewModel, context) {
        taskDeleteViewModel.notices.collect { deletion ->
            val result = snackbar.showSnackbar(
                message = AppStrings.get(context, R.string.task_deleted, deletion.title),
                actionLabel = AppStrings.get(context, R.string.undo),
                duration = SnackbarDuration.Short,
            )
            if (result == SnackbarResult.ActionPerformed) {
                taskDeleteViewModel.undo(deletion.taskId)
            } else {
                taskDeleteViewModel.commit(deletion.taskId)
            }
        }
    }
    LaunchedEffect(taskDeleteViewModel) {
        taskDeleteViewModel.errors.collect { snackbar.showSnackbar(it) }
    }
    val notifPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {}
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    val quickAddRequests = remember { Channel<Unit>(Channel.CONFLATED) }

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val currentKind = backStackEntry?.arguments?.getString("kind")
    val onListRoute = currentRoute?.startsWith("list/") == true

    fun switchTab(route: String) {
        navController.navigate(route) {
            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    // above the tab bar too so it is opened here rather than inside ListsScreen
    var newListOpen by rememberSaveable { mutableStateOf(false) }
    val listsViewModel: ListsViewModel = hiltViewModel()

    Box(Modifier.fillMaxSize()) {
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { OrangSnackbarHost(hostState = snackbar, modifier = Modifier.imePadding()) },
        bottomBar = {
            OrangTabBar(
                todayActive = currentRoute == "view/{kind}" && currentKind == "today",
                listsActive = mainTabForRoute(currentRoute) == MainTab.LISTS,
                searchActive = currentRoute == "search",
                settingsActive = currentRoute == "settings",
                onToday = { haptics.tap(); switchTab("view/today") },
                onLists = {
                    haptics.tap()
                    // the tab restores the last open list tapping it again inside a list goes to all lists
                    if (onListRoute) {
                        if (!navController.popBackStack("lists", inclusive = false)) {
                            navController.navigate("lists") { launchSingleTop = true }
                        }
                    } else {
                        switchTab("lists")
                    }
                },
                onAdd = {
                    haptics.tap()
                    val hasQuickAdd = onListRoute ||
                        (currentRoute == "view/{kind}" && currentKind in listOf("today", "all"))
                    if (!hasQuickAdd) switchTab("view/today")
                    quickAddRequests.trySend(Unit)
                },
                onSearch = { haptics.tap(); switchTab("search") },
                onSettings = { haptics.tap(); switchTab("settings") },
            )
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = "view/{kind}",
            modifier = Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding),
            enterTransition = {
                if (disablesTabTransition(initialState.destination.route, targetState.destination.route)) {
                    EnterTransition.None
                } else {
                    slideInHorizontally(
                        initialOffsetX = { it },
                        animationSpec = tween(300),
                    )
                }
            },
            exitTransition = {
                if (disablesTabTransition(initialState.destination.route, targetState.destination.route)) {
                    ExitTransition.None
                } else {
                    slideOutHorizontally(
                        targetOffsetX = { -it },
                        animationSpec = tween(300),
                    )
                }
            },
            popEnterTransition = {
                if (disablesTabTransition(initialState.destination.route, targetState.destination.route)) {
                    EnterTransition.None
                } else {
                    slideInHorizontally(
                        initialOffsetX = { -it },
                        animationSpec = tween(300),
                    )
                }
            },
            popExitTransition = {
                if (disablesTabTransition(initialState.destination.route, targetState.destination.route)) {
                    ExitTransition.None
                } else {
                    slideOutHorizontally(
                        targetOffsetX = { it },
                        animationSpec = tween(300),
                    )
                }
            },
        ) {
            composable(
                route = "view/{kind}",
                arguments = listOf(navArgument("kind") { defaultValue = "today" }),
            ) {
                TaskListScreen(
                    quickAddRequests = quickAddRequests,
                    onListDeleted = {},
                    onOpenNotifications = { navController.navigate("notifications") },
                )
            }
            composable(

                route = "list/{listId}?task={task}",
                arguments = listOf(
                    navArgument("task") {
                        type = NavType.StringType
                        nullable = true
                    }
                ),
            ) {
                TaskListScreen(
                    quickAddRequests = quickAddRequests,
                    onListDeleted = { navController.popBackStack() },
                )
            }
            composable("lists") {
                ListsScreen(
                    onOpenView = { kind -> navController.navigate("view/$kind") },
                    onOpenList = { id -> navController.navigate("list/$id") },
                    onOpenScratchpads = { navController.navigate("scratchpads") },
                    onNewList = { newListOpen = true },
                )
            }
            composable("scratchpads") {
                ScratchpadsScreen(onBack = { navController.popBackStack() })
            }
            composable("search") {
                SearchScreen(
                    onOpenTask = { listId, taskId -> navController.navigate("list/$listId?task=$taskId") },
                )
            }
            composable("notifications") {
                NotificationsScreen(
                    onBack = { navController.popBackStack() },
                    onOpenList = { listId -> navController.navigate("list/$listId") },
                )
            }
            composable("settings") {
                SettingsScreen(user = user, onLogout = onLogout, onUserChanged = onUserChanged)
            }
        }
    }

    AnimatedVisibility(visible = newListOpen, enter = fadeIn(tween(150)), exit = fadeOut(tween(150))) {
        NewListDialog(
            onDismiss = { newListOpen = false },
            onSuggest = listsViewModel::suggestIcon,
            onCreate = { name, color, icon ->
                newListOpen = false
                listsViewModel.createList(name, color, icon) { id -> navController.navigate("list/$id") }
            },
        )
    }
    }
}

@Composable
private fun OrangTabBar(
    todayActive: Boolean,
    listsActive: Boolean,
    searchActive: Boolean,
    settingsActive: Boolean,
    onToday: () -> Unit,
    onLists: () -> Unit,
    onAdd: () -> Unit,
    onSearch: () -> Unit,
    onSettings: () -> Unit,
) {
    val dark = isDarkTheme()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(if (dark) Ink850 else Color.White)
            .navigationBarsPadding(),
    ) {
        HorizontalDivider(color = if (dark) Ink700 else Color(0xFFE5E7EB))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().height(64.dp),
        ) {
            TabSlot(Icons.Outlined.WbSunny, R.string.today, todayActive, onToday, Modifier.weight(1f))
            TabSlot(Icons.Outlined.Layers, R.string.lists, listsActive, onLists, Modifier.weight(1f))

            Box(contentAlignment = Alignment.Center, modifier = Modifier.weight(1f)) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .offset(y = (-14).dp)
                        .size(56.dp)
                        .background(Orange500)
                        .clickable(onClick = onAdd),
                ) {
                    Icon(
                        Icons.Outlined.Add,
                        contentDescription = tr(R.string.add_task),
                        tint = Color.White,
                        modifier = Modifier.size(28.dp),
                    )
                }
            }

            TabSlot(Icons.Outlined.Search, R.string.search, searchActive, onSearch, Modifier.weight(1f))
            TabSlot(Icons.Outlined.Settings, R.string.settings, settingsActive, onSettings, Modifier.weight(1f))
        }
    }
}

@Composable
private fun TabSlot(
    icon: ImageVector,
    labelRes: Int,
    active: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val label = tr(labelRes)
    val tint = if (active) Orange500 else MaterialTheme.colorScheme.onSurfaceVariant
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center,
        modifier = modifier
            .fillMaxSize()
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick,
            ),
    ) {
        Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(22.dp))
        Text(label, fontSize = 10.sp, color = tint, modifier = Modifier.padding(top = 2.dp))
    }
}
