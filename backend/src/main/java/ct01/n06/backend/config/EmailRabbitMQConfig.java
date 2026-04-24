package ct01.n06.backend.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class EmailRabbitMQConfig {

  public static final String QUEUE_NAME = "notification_email_queue";
  public static final String EXCHANGE_NAME = "notification_email_exchange";
  public static final String ROUTING_KEY = "notification.email.send";

  @Bean
  public Queue notificationEmailQueue() {
    return new Queue(QUEUE_NAME, true);
  }

  @Bean
  public DirectExchange notificationEmailExchange() {
    return new DirectExchange(EXCHANGE_NAME);
  }

  @Bean
  public Binding bindingNotificationEmailQueue(Queue notificationEmailQueue, DirectExchange notificationEmailExchange) {
    return BindingBuilder.bind(notificationEmailQueue).to(notificationEmailExchange).with(ROUTING_KEY);
  }
}