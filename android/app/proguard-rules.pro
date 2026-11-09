# FamilyOS Production ProGuard & R8 Obfuscation Rules

# Preserve Kotlinx Serialization models
-keepattributes *Annotation*,InnerClasses
-dontnote kotlinx.serialization.SerializationKt
-keepclassmembers class * {
    @kotlinx.serialization.SerialName <fields>;
}
-keepclassmembers class * {
    *** Companion;
}

# Preserve Room entities & DAOs
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-keepclassmembers @androidx.room.Entity class * { *; }
-keep @androidx.room.Dao interface *
-keepclassmembers @androidx.room.Dao interface * { *; }

# SQLCipher
-keep class net.zetetic.database.sqlcipher.** { *; }
-dontwarn net.zetetic.database.sqlcipher.**

# Firebase SDK & Authentication / Firestore / Messaging
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Google Play Billing Library v7
-keep class com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**

