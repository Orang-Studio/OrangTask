package lt.oranges.orangtask.core.network

const val PAGE_SIZE = 200

private const val MAX_PAGES = 50

suspend fun <T> fetchAllPages(fetch: suspend (offset: Int) -> Pair<List<T>, Int?>): List<T> {
    val all = mutableListOf<T>()
    var offset: Int? = 0
    var page = 0

    while (offset != null && page < MAX_PAGES) {
        val (rows, next) = fetch(offset)
        all += rows
        offset = next
        page++
    }

    return all
}
