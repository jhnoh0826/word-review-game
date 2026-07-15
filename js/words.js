/* =========================================================================
 *  단어 데이터 파일
 * =========================================================================
 *  학생별로 단어 리스트를 따로 관리합니다.
 *  새 단어를 추가하려면 아래 목록에 { } 한 줄을 복사해서 채워 넣으면 됩니다.
 *
 *  word        : 영어 단어
 *  meaning_ko  : 한글 뜻
 *  meaning_en  : 영영 풀이 (영어 설명)
 *  example     : 단어가 들어간 예문 (단어를 그대로 포함해야 빈칸 문제가 만들어집니다)
 *
 *  ※ Lily용 단어는 WORD_DATA.lily 목록에 똑같은 형식으로 넣으면 됩니다.
 * ========================================================================= */

const WORD_DATA = {
  ben: [
    {
      word: "skid",
      meaning_ko: "미끄러지다",
      meaning_en: "to slide along a surface without control",
      example: "The car skidded on the icy road and hit a fence.",
    },
    {
      word: "exotic",
      meaning_ko: "이국적인",
      meaning_en: "unusual and exciting because of coming from a country that is not one's own",
      example: "One of my favorite things to do while traveling is trying exotic dishes.",
    },
    {
      word: "console",
      meaning_ko: "콘솔 (게임기), 제어기",
      meaning_en: "an electronic device for playing games",
      example: "My parents took away my game console as punishment for my bad grades.",
    },
    {
      word: "repellent",
      meaning_ko: "방충제",
      meaning_en: "a substance that keeps insects or other pests away",
      example: "I sprayed insect repellent around my tent, so bugs would not enter.",
    },
    {
      word: "foliage",
      meaning_ko: "나뭇잎, 잎사귀",
      meaning_en: "the leaves of a plant or tree",
      example: "The foliage shaded the path from the sun.",
    },
    {
      word: "carnivorous",
      meaning_ko: "육식성의",
      meaning_en: "relating to a person, animal, or other living thing that eats meat",
      example: "Venus flytraps are examples of carnivorous plants.",
    },
    {
      word: "poacher",
      meaning_ko: "밀렵꾼",
      meaning_en: "someone who catches and kills animals illegally",
      example: "The poacher tried to catch animals in the wild.",
    },
    {
      word: "nocturnal",
      meaning_ko: "야행성의",
      meaning_en: "being active or happening at night rather than during the day",
      example: "Bats are nocturnal animals that sleep during the day.",
    },
    {
      word: "abandon",
      meaning_ko: "버리다, 포기하다",
      meaning_en: "to leave a place, thing, or person, usually forever",
      example: "You should not adopt pets if you are going to abandon them.",
    },
    {
      word: "burrow",
      meaning_ko: "(동물의) 굴, 은신처",
      meaning_en: "a hole in the ground dug by animals as a hiding place or home",
      example: "I saw a family of meerkats go into their burrow to rest.",
    },
    {
      word: "bank",
      meaning_ko: "강둑, 기슭",
      meaning_en: "the ground at the edge of a river or stream",
      example: "Some flowers grow on river banks and near streams.",
    },
    {
      word: "swerve",
      meaning_ko: "갑자기 방향을 틀다",
      meaning_en: "to change direction suddenly",
      example: "The driver swerved dangerously, leaving tire marks on the road.",
    },
    {
      word: "litterbug",
      meaning_ko: "쓰레기를 함부로 버리는 사람",
      meaning_en: "(slang) someone who throws away garbage on the ground in public places",
      example: "I frown every time I see litterbugs throwing trash on the street.",
    },
    {
      word: "sinister",
      meaning_ko: "불길한, 사악한",
      meaning_en: "giving the impression that something harmful or evil will happen",
      example: "The actor's sinister smile made me stop watching the movie.",
    },
    {
      word: "withstand",
      meaning_ko: "견뎌내다, 저항하다",
      meaning_en: "to be strong enough to oppose",
      example: "I tried very hard to withstand the temptation to eat cake after exercising.",
    },
    {
      word: "cultivation",
      meaning_ko: "경작, 재배",
      meaning_en: "the act of preparing land and growing crops on it",
      example: "The cultivation of vegetables requires good soil and plenty of water.",
    },
    {
      word: "distribution",
      meaning_ko: "분배, 배포, 유통",
      meaning_en: "the way in which something is shared out among a group or spread over an area",
      example: "The distribution of food supplies was carefully managed.",
    },
    {
      word: "requires",
      meaning_ko: "필요로 하다, 요구하다",
      meaning_en: "to need something or make something necessary",
      example: "This difficult project requires a lot of time and effort.",
    },
    {
      word: "monuments",
      meaning_ko: "기념물, 기념비",
      meaning_en: "statues, buildings, or other structures built to honor a famous person or event",
      example: "We visited several historical monuments during our trip.",
    },
    {
      word: "invasion",
      meaning_ko: "침략, 침입",
      meaning_en: "an instance of a large number of people or things entering a place by force",
      example: "The country prepared its defenses against the enemy's invasion.",
    },
    {
      word: "succumb",
      meaning_ko: "굴복하다, 무릎을 꿇다",
      meaning_en: "to stop trying to resist something; to accept defeat",
      example: "After a long siege, the city finally succumbed to the enemy forces.",
    },
    {
      word: "conquer",
      meaning_ko: "정복하다",
      meaning_en: "to take control or possession of foreign land, or a group of people, by force",
      example: "The ancient empire conquered many territories across the continent.",
    },
    {
      word: "occupy",
      meaning_ko: "점령하다, 차지하다",
      meaning_en: "to take control of a place, especially by military force",
      example: "The troops occupied the town for several months.",
    },
  ],

  lily: [
    // 여기에 Lily용 단어를 넣으세요. 형식은 위 Ben 목록과 같습니다.
    // {
    //   word: "example",
    //   meaning_ko: "예시",
    //   meaning_en: "a thing that shows what something is like",
    //   example: "This is an example sentence.",
    // },
  ],
};
