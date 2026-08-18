# Voice Transcription Fixture Sources

## Kannada candidate

Wikimedia Commons hosts **“A street scrap paper vendor calling ‘paper’ in a Bengaluru street.mp3”** as an original 2-minute MP3 recording under **CC BY-SA 4.0**. Its page identifies the source as a Bengaluru street recording and provides the original media URL. Because Sarvam’s synchronous REST endpoint accepts clips of no more than 30 seconds, only a short extracted segment will be used for a transient functional transcription check; the external recording will not be committed to or served by the application.

| Item | Source |
|---|---|
| File page | https://commons.wikimedia.org/wiki/File:A_street_scrap_paper_vendor_calling_%22paper%22_in_a_Bengaluru_street.mp3 |
| Original MP3 | https://upload.wikimedia.org/wikipedia/commons/6/6a/A_street_scrap_paper_vendor_calling_%22paper%22_in_a_Bengaluru_street.mp3 |
| Licence | CC BY-SA 4.0 |

OpenSLR also documents its SLR79 corpus as quality-checked Kannada WAV recordings with aligned text, licensed CC BY-SA 4.0; its full archives are not needed for this narrowly scoped validation. Source: https://www.openslr.org/79/.

## English candidate

The Open Speech Repository’s American English collection provides freely reusable 8 kHz, 16-bit PCM WAV Harvard-sentence recordings for speech/VoIP testing. A short original file will be used transiently to verify that the explicit `en-IN` hint reaches Sarvam’s live voice route; it will not be bundled into the app. Source: https://www.voiptroubleshooter.com/open_speech/american.html.

The inspected source page lists `OSR_us_000_0010_8k.wav` through `OSR_us_000_0061_8k.wav` as its American English downloadable Harvard-sentence samples and permits copying/downloading for reasonable testing, research, development, and related use with Open Speech Repository attribution.
