package lt.oranges.orangtask.core.db

import android.content.Context
import androidx.room.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DbModule {

    @Provides
    @Singleton
    fun provideDb(@ApplicationContext context: Context): OrangDb =
        Room.databaseBuilder(context, OrangDb::class.java, "orangtask.db")
            // local data is a cache of the server; on schema change, resync
            .fallbackToDestructiveMigration()
            .build()

    @Provides fun provideTaskDao(db: OrangDb): TaskDao = db.taskDao()
    @Provides fun provideListDao(db: OrangDb): ListDao = db.listDao()
    @Provides fun provideTagDao(db: OrangDb): TagDao = db.tagDao()
    @Provides fun providePendingOpDao(db: OrangDb): PendingOpDao = db.pendingOpDao()
}
