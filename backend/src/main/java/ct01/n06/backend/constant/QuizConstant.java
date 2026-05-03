package ct01.n06.backend.constant;

public class QuizConstant {

  private QuizConstant() {
  }

  public static final String TABLE_QUIZZES          = "quizzes";
  public static final String COL_QUIZ_ID            = "id";
  public static final String COL_QUIZ_TITLE         = "title";
  public static final String COL_QUIZ_SUBJECT       = "subject";
  public static final String COL_QUIZ_TYPE          = "type";
  public static final String COL_EXAM_IMAGE_URL     = "exam_image_url";
  public static final String COL_TOTAL_QUESTIONS    = "total_questions";
  public static final String COL_TIME_LIMIT_MINUTES = "time_limit_minutes";
  public static final String COL_MAX_ATTEMPTS       = "max_attempts";
  public static final String COL_START_TIME         = "start_time";
  public static final String COL_END_TIME           = "end_time";
  public static final String COL_QUIZ_STATUS        = "status";
  public static final String COL_QUIZ_CREATED_AT    = "created_at";
  public static final String COL_QUIZ_UPDATED_AT    = "updated_at";
  public static final String COL_QUIZ_CREATED_BY    = "created_by";

  public static final String TABLE_ANSWER_KEYS        = "quiz_answer_keys";
  public static final String COL_AK_ID               = "id";
  public static final String COL_AK_QUIZ_ID          = "quiz_id";
  public static final String COL_AK_QUESTION_NUMBER  = "question_number";
  public static final String COL_AK_CORRECT_OPTION   = "correct_option";

  public static final String TABLE_ASSIGNMENTS      = "quiz_assignments";
  public static final String COL_ASSIGN_ID          = "id";
  public static final String COL_ASSIGN_QUIZ_ID     = "quiz_id";
  public static final String COL_ASSIGN_CLASS_ID    = "class_id";
  public static final String COL_ASSIGN_ASSIGNED_AT = "assigned_at";

  public static final String TABLE_ATTEMPTS               = "quiz_attempts";
  public static final String COL_ATT_ID                  = "id";
  public static final String COL_ATT_QUIZ_ID             = "quiz_id";
  public static final String COL_ATT_STUDENT_ID          = "student_id";
  public static final String COL_ATT_START_TIME          = "start_time";
  public static final String COL_ATT_END_TIME            = "end_time";
  public static final String COL_ATT_SCORE               = "score";
  public static final String COL_ATT_STUDENT_ANSWERS_JSON = "student_answers_json";
  public static final String COL_ATT_STATUS              = "status";
}
