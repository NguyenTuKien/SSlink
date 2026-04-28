package ct01.n06.backend.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FaceUpdateRabbitMQConfig {

  public static final String QUEUE_NAME = "face_update_request_queue";
  public static final String EXCHANGE_NAME = "face_update_request_exchange";
  public static final String ROUTING_KEY = "face.update.request.process";

  @Bean
  public Queue faceUpdateRequestQueue() {
    return new Queue(QUEUE_NAME, true);
  }

  @Bean
  public DirectExchange faceUpdateRequestExchange() {
    return new DirectExchange(EXCHANGE_NAME);
  }

  @Bean
  public Binding bindingFaceUpdateRequest(Queue faceUpdateRequestQueue, DirectExchange faceUpdateRequestExchange) {
    return BindingBuilder.bind(faceUpdateRequestQueue).to(faceUpdateRequestExchange).with(ROUTING_KEY);
  }
}
