package ct01.n06.backend.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FaceProfileEnrollRabbitMQConfig {

  public static final String QUEUE_NAME = "face_profile_enroll_queue";
  public static final String EXCHANGE_NAME = "face_profile_enroll_exchange";
  public static final String ROUTING_KEY = "face.profile.enroll.process";

  @Bean
  public Queue faceProfileEnrollQueue() {
    return new Queue(QUEUE_NAME, true);
  }

  @Bean
  public DirectExchange faceProfileEnrollExchange() {
    return new DirectExchange(EXCHANGE_NAME);
  }

  @Bean
  public Binding bindingFaceProfileEnroll(Queue faceProfileEnrollQueue, DirectExchange faceProfileEnrollExchange) {
    return BindingBuilder.bind(faceProfileEnrollQueue).to(faceProfileEnrollExchange).with(ROUTING_KEY);
  }
}
