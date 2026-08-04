Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$text = 'In this part, you are going to hear a dialogue or exchange, after the exchange, there will be a question. After each question, you have 5 seconds to think and choose the correct answer. You will hear each question only once.'
$synth.SetOutputToWaveFile($args[0])
$synth.Speak($text)
$synth.Dispose()
Write-Host "Generated $($args[0])"
