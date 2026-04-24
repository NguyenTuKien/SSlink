FROM maven:3.9.6-eclipse-temurin-21 AS build
LABEL author="ngtukien"
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN cp src/main/resources/application-example.yaml src/main/resources/application-prod.yaml
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
ENV TZ=Asia/HoChiMinh
COPY --from=build /app/target/*.jar ./app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar", "--spring.profiles.active=prod"]