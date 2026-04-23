FROM maven:3.9.6-eclipse-temurin-21 AS build
LABEL author="ngtukien"
WORKDIR /app
# 1. Chỉ copy pom.xml trước
COPY pom.xml .

# 2. Tải trước các thư viện về cache của Docker (chỉ chạy lại bước này nếu pom.xml thay đổi)
RUN mvn dependency:go-offline -B

# 3. Sau đó mới copy source code và build
COPY src ./src
RUN cp src/main/resources/application.yaml.example src/main/resources/application.yaml
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
ENV TZ=Asia/HoChiMinh
COPY --from=build /app/target/*.jar ./app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]