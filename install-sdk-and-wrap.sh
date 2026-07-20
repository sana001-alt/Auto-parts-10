#!/bin/bash
set -e

echo "=== 1. Cleaning up package manager locks ==="
export DEBIAN_FRONTEND=noninteractive
killall apt-get apt dpkg || true
rm -f /var/lib/dpkg/lock /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock /var/cache/apt/archives/lock
dpkg --configure --force-confold --force-confdef -a

echo "=== 2. Installing Java 21, Unzip, Wget, Curl ==="
apt-get update
apt-get install -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" -y openjdk-21-jdk-headless unzip wget curl

export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH
echo "Java Version:"
java -version

echo "=== 3. Downloading official Gradle 8.14.3 to generate the wrapper ==="
if [ ! -f /tmp/gradle-8.14.3-bin.zip ]; then
    wget -q --show-progress -O /tmp/gradle-8.14.3-bin.zip https://services.gradle.org/distributions/gradle-8.14.3-bin.zip
fi

echo "=== 4. Extracting Gradle 8.14.3 ==="
rm -rf /tmp/gradle-8.14.3
unzip -q /tmp/gradle-8.14.3-bin.zip -d /tmp/

echo "=== 5. Regenerating official Gradle Wrapper ==="
# We must execute the official gradle command inside the android directory
# so that the wrapper is generated relative to that directory.
cd /app/applet/android
/tmp/gradle-8.14.3/bin/gradle wrapper --gradle-version 8.14.3 --distribution-type all

# Check if the wrapper was generated correctly and verify file format
echo "Generated files:"
ls -la gradle/wrapper/
file gradle/wrapper/gradle-wrapper.jar

echo "=== 6. Setting up Android SDK ==="
mkdir -p /opt/android-sdk/cmdline-tools

if [ ! -f /tmp/cmdline-tools.zip ]; then
    wget -q --show-progress -O /tmp/cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
fi

rm -rf /opt/android-sdk/cmdline-tools/latest
unzip -q /tmp/cmdline-tools.zip -d /tmp/cmdline-tools-extracted
mkdir -p /opt/android-sdk/cmdline-tools/latest
mv /tmp/cmdline-tools-extracted/cmdline-tools/* /opt/android-sdk/cmdline-tools/latest/
rm -rf /tmp/cmdline-tools-extracted /tmp/cmdline-tools.zip

export PATH=/opt/android-sdk/cmdline-tools/latest/bin:$PATH

echo "=== 7. Accepting licenses ==="
yes | sdkmanager --sdk_root=/opt/android-sdk --licenses

echo "=== 8. Installing SDK Platforms and build tools ==="
sdkmanager --sdk_root=/opt/android-sdk "platform-tools" "platforms;android-36" "build-tools;35.0.0"

echo "=== 9. Creating local.properties ==="
echo "sdk.dir=/opt/android-sdk" > /app/applet/android/local.properties

echo "=== 10. Syncing web assets using capacitor ==="
cd /app/applet
npm run build
npx cap sync android

echo "=== 11. Building Debug APK ==="
cd /app/applet
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH
chmod +x ./android/gradlew
./android/gradlew -p android assembleDebug

echo "=== 12. Building Release APK ==="
./android/gradlew -p android assembleRelease

echo "=== 13. Verifying generated APKs ==="
find android -name "*.apk" -ls

echo "=== Process Complete! ==="
