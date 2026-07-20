#!/bin/bash
set -e

echo "=== 1. Setting up JDK 21 ==="
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

echo "=== 2. Deleting current gradle-wrapper.jar ==="
rm -f android/gradle/wrapper/gradle-wrapper.jar

echo "=== 3. Downloading official Gradle 8.14.3 distribution ==="
if [ ! -f /tmp/gradle-8.14.3-bin.zip ]; then
    echo "Downloading Gradle 8.14.3..."
    wget -q --show-progress -O /tmp/gradle-8.14.3-bin.zip https://services.gradle.org/distributions/gradle-8.14.3-bin.zip
fi

echo "=== 4. Extracting Gradle 8.14.3 ==="
rm -rf /tmp/gradle-8.14.3
unzip -q /tmp/gradle-8.14.3-bin.zip -d /tmp/

echo "=== 5. Regenerating Gradle Wrapper ==="
/tmp/gradle-8.14.3/bin/gradle wrapper --gradle-version 8.14.3 --project-dir android

echo "=== 6. Verifying Gradle Wrapper ==="
cd android
chmod +x gradlew
./gradlew --version
cd ..

echo "=== 7. Initializing Git & Committing files ==="
git init || true
git config user.name "AI Studio Assistant" || true
git config user.email "ym1950394@gmail.com" || true

# Create .gitattributes if not exists
if [ ! -f .gitattributes ]; then
    echo "*.jar binary" > .gitattributes
    echo "*.png binary" >> .gitattributes
fi

git add . || true
git commit -m "Regenerate Gradle Wrapper correctly and initialize clean git repo" || true

echo "=== 8. Starting full Android APK build ==="
chmod +x build-apk.sh
./build-apk.sh
