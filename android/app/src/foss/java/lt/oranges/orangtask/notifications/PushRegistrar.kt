package lt.oranges.orangtask.notifications

import javax.inject.Inject
import javax.inject.Singleton

/** foss build: no Firebase, so there is nothing to register and pushes never arrive */
@Singleton
class PushRegistrar @Inject constructor() {
    fun register() = Unit
    fun onNewToken(token: String) = Unit
    fun unregister() = Unit
}
