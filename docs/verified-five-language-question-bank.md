# SvaraProof Verified Five-Language Question Bank

This testing bank contains **25 source-backed prompts** for the live SvaraProof evaluator: five each in English, Hindi, Kannada, Tamil, and Marathi. The prompts are tied to real MSMARCO-XI evidence themes. The live validation run confirmed that the five English, five Kannada, five Tamil, and five Marathi fixture themes ground successfully; the Hindi set replaces the one short-form corporation query that correctly fails the evidence threshold with the separately verified Hindi corporation-law prompt.

> **How to test:** Select the matching language, speak the prompt slowly, then check for a **GROUNDED** status and at least one citation. The expected answer topic below is only for checking that the response is on topic; SvaraProof should derive the actual answer from cited evidence.

## English

| # | Ask this question | Expected answer topic | Source query ID |
|---:|---|---|---|
| 1 | What is a corporation? | A corporation is a legal entity formed through incorporation. | 1102432 |
| 2 | Why did Rachel Carson write *The Obligation to Endure*? | Pesticide use and its effects on people and the environment. | 1102431 |
| 3 | What foods are low in potassium? | Low-potassium food choices and serving sizes. | 90836 |
| 4 | What is the lower side of a cargo ship called? | The hull/bottom and the bilge. | 55665 |
| 5 | What is the definition of honesty or integrity? | Truthfulness, reliability, and moral principles. | 205107 |

## Hindi

| # | Ask this question | English pronunciation | Expected answer topic | Source query ID |
|---:|---|---|---|---|
| 1 | निगम किस कानून द्वारा शासित होता है? | *Nigam kis kanoon dwaara shaasit hota hai?* | Incorporation law in the relevant state or country. | 1102432 |
| 2 | रेचल कार्सन ने द ऑब्लिगेशन टू एंड्योर क्यों लिखा? | *Rachel Carson ne The Obligation to Endure kyon likha?* | Harm from indiscriminate pesticide use. | 1102431 |
| 3 | पोटेशियम में कम खाद्य पदार्थों का चार्ट क्या है? | *Potassium mein kam khaadya padarthon ka chart kya hai?* | Low-potassium food choices. | 90836 |
| 4 | मालवाहक जहाज़ के नीचे की तरफ क्या होता है? | *Maalvaahak jahaaz ke neeche ki taraf kya hota hai?* | The lower ship area, hull, or bilge. | 55665 |
| 5 | ईमानदारी या सत्यनिष्ठा की परिभाषा क्या है? | *Imaandaari ya satyanishtha ki paribhaasha kya hai?* | Truthfulness and moral principles. | 205107 |

## Kannada

| # | Ask this question | Expected answer topic | Source query ID |
|---:|---|---|---|
| 1 | ಕಂಪನಿಯು ಯಾವ ಕಾನೂನುಗಳಿಂದ ಆಡಳಿತ ನಡೆಸುತ್ತದೆ? | Incorporation law in the relevant state or country. | 1102432 |
| 2 | ರೇಚಲ್ ಕಾರ್ಸನ್ ದಿ ಒಬ್ಲಿಗೇಶನ್ ಟು ಎಂಡ್ಯೂರ್ ಏಕೆ ಬರೆದರು? | Harm from indiscriminate pesticide use. | 1102431 |
| 3 | ಕಡಿಮೆ ಪೊಟ್ಯಾಸಿಯಮ್ ಇರುವ ಆಹಾರಗಳ ಪಟ್ಟಿ ಏನು? | Low-potassium food choices. | 90836 |
| 4 | ಸರಕು ಹಡಗಿನ ಕೆಳಭಾಗವನ್ನು ಏನೆಂದು ಕರೆಯುತ್ತಾರೆ? | The lower ship area, hull, or bilge. | 55665 |
| 5 | ಪ್ರಾಮಾಣಿಕತೆ ಅಥವಾ ಸತ್ಯನಿಷ್ಠೆಯ ವ್ಯಾಖ್ಯಾನ ಏನು? | Truthfulness and moral principles. | 205107 |

## Tamil

| # | Ask this question | Expected answer topic | Source query ID |
|---:|---|---|---|
| 1 | ஒரு நிறுவனம் என்பது என்ன? | A corporation is a legal entity formed through incorporation. | 1102432 |
| 2 | ரேச்சல் கார்சன் ஏன் தி ஆப்ளிகேஷன் டு என்டியர் எழுதினார்? | Harm from indiscriminate pesticide use. | 1102431 |
| 3 | பொட்டாசியம் குறைவுள்ள உணவுகளுக்கான வரைபடம் என்ன? | Low-potassium food choices. | 90836 |
| 4 | சரக்குக் கப்பலின் கீழ்ப்பகுதி என்ன என்று அழைக்கப்படுகிறது? | The lower ship area, hull, or bilge. | 55665 |
| 5 | நேர்மை அல்லது ஒருமைப்பாட்டின் வரையறை என்ன? | Truthfulness and moral principles. | 205107 |

## Marathi

| # | Ask this question | Expected answer topic | Source query ID |
|---:|---|---|---|
| 1 | कॉर्पोरेशन म्हणजे काय? | A corporation is a legal entity formed through incorporation. | 1102432 |
| 2 | रेचल कार्सनने द ऑब्लिगेशन टू एंड्युअर का लिहिले? | Harm from indiscriminate pesticide use. | 1102431 |
| 3 | पोटॅशियमचे प्रमाण कमी असलेल्या खाद्यपदार्थांचा तक्ता काय आहे? | Low-potassium food choices. | 90836 |
| 4 | मालवाहू जहाजाच्या खालच्या बाजूला काय म्हणतात? | The lower ship area, hull, or bilge. | 55665 |
| 5 | प्रामाणिकपणा किंवा सचोटीची व्याख्या काय आहे? | Truthfulness and moral principles. | 205107 |

## Important Boundary

The evaluator remains intentionally **fail-closed**. A response marked `REFUSED` means the question did not meet the evidence threshold. It should not be treated as a transcription failure when the transcript is correct. For a reliable demonstration, use one of the prompts above and verify both the `GROUNDED` status and the citation count.

## Source

The prompts and evidence themes originate from the indexed AI4Bharat MSMARCO-XI corpus and its English companion records. The full 1,000-query five-language validation reuses these five evidence themes in each language and records the raw result for audit.

**Reference**

[1] [AI4Bharat, *MSMARCO-XI*](https://huggingface.co/datasets/ai4bharat/MSMARCO-XI)
