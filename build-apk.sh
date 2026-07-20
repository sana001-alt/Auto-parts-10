#!/bin/bash
set -e

LOG_FILE="/app/applet/android_build.log"
exec > >(tee -i "$LOG_FILE") 2>&1

echo "=== [$(date)] Starting Android SDK Setup and Build ==="

echo "=== 0. Setting up JDK 21 ==="
if [ ! -d /opt/jdk-21 ]; then
    echo "Downloading JDK 21..."
    curl -L -o /tmp/openjdk-21.tar.gz "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/adoptium?project=jdk"
    mkdir -p /opt/jdk-21
    tar -xzf /tmp/openjdk-21.tar.gz -C /opt/jdk-21 --strip-components=1
    rm -f /tmp/openjdk-21.tar.gz
fi

export JAVA_HOME=/opt/jdk-21
export PATH=$JAVA_HOME/bin:$PATH

echo "Using Java Home: $JAVA_HOME"
java -version

echo "=== 1. Creating directories ==="
mkdir -p /opt/android-sdk/cmdline-tools

echo "=== 2. Downloading Command Line Tools ==="
if [ ! -f /tmp/cmdline-tools.zip ]; then
    echo "Downloading cmdline-tools..."
    wget -q --show-progress -O /tmp/cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
fi

echo "=== 3. Extracting Command Line Tools ==="
rm -rf /opt/android-sdk/cmdline-tools/latest
rm -rf /tmp/cmdline-tools-extracted
unzip -q /tmp/cmdline-tools.zip -d /tmp/cmdline-tools-extracted
mkdir -p /opt/android-sdk/cmdline-tools/latest
mv /tmp/cmdline-tools-extracted/cmdline-tools/* /opt/android-sdk/cmdline-tools/latest/
rm -rf /tmp/cmdline-tools-extracted

echo "=== 4. Setting up SDK Paths ==="
export PATH=/opt/android-sdk/cmdline-tools/latest/bin:$PATH

echo "=== 5. Accepting SDK Licenses ==="
yes | sdkmanager --sdk_root=/opt/android-sdk --licenses

echo "=== 6. Installing SDK Packages (platform-tools, android-36, build-tools 35.0.0) ==="
yes | sdkmanager --sdk_root=/opt/android-sdk "platform-tools" "platforms;android-36" "build-tools;35.0.0"

echo "=== 7. Writing local.properties ==="
echo "sdk.dir=/opt/android-sdk" > /app/applet/android/local.properties

echo "=== 8. Checking Node and NPM ==="
node -v
npm -v

echo "=== 9. Building React Web Assets ==="
npm run build

echo "=== 10. Syncing Web Assets to Android ==="
npx cap sync android

echo "=== 11. Building Debug APK (Memory-Optimized) ==="
chmod +x ./android/gradlew
./android/gradlew -Dorg.gradle.jvmargs="-Xmx768m -XX:MaxMetaspaceSize=256m" --no-daemon -p android clean
./android/gradlew -Dorg.gradle.jvmargs="-Xmx768m -XX:MaxMetaspaceSize=256m" --no-daemon -p android assembleDebug

echo "=== 12. Building Release APK (Memory-Optimized) ==="
./android/gradlew -Dorg.gradle.jvmargs="-Xmx768m -XX:MaxMetaspaceSize=256m" --no-daemon -p android assembleRelease

echo "=== 13. Verifying and Listing Generated APKs ==="
find android -name "*.apk" -ls

echo "=== [$(date)] Android Build Complete! ==="
