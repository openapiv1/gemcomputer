# Diagram przepływu - Poprawka czatu

## Przepływ danych przed poprawką ❌

```
Backend (route.ts)                Frontend (use-custom-chat.ts)           UI (message.tsx)
─────────────────                 ──────────────────────────────           ────────────────

sendEvent({                       
  type: "text-delta",             
  delta: "Hello"                  
}) ────────────────────────────>  assistantMessage.content += "Hello"
                                  ❌ Mutacja obiektu!
                                  
                                  setMessages([                           
                                    ...,                                  
                                    { ...assistantMessage }               
                                  ])                                      
                                  ❌ Płytka kopia
                                                                          React.memo sprawdza:
                                                                          - content? ✓ (zmieniony)
                                                                          - parts? ✓ (ten sam)
                                                                          
                                                                          ✅ Re-render!
                                                                          ───────────────────
                                                                          [Wyświetla: "Hello"]


sendEvent({
  type: "pre-action-screenshot",
  toolCallId: "123",
  screenshot: "base64..."
}) ────────────────────────────>  assistantMessage.preActionScreenshots["123"] = "base64..."
                                  ❌ Mutacja zagnieżdżonego obiektu!
                                  
                                  setMessages([
                                    ...,
                                    { ...assistantMessage }
                                  ])
                                  ❌ Płytka kopia - preActionScreenshots wskazuje na ten sam obiekt!
                                  
                                                                          React.memo sprawdza:
                                                                          - content? ✓ (ten sam)
                                                                          - parts? ✓ (ten sam)
                                                                          - preActionScreenshots? ❌ NIE SPRAWDZA!
                                                                          
                                                                          ❌ BEZ re-render!
                                                                          ───────────────────
                                                                          [NIE wyświetla screenshota]
```

## Przepływ danych po poprawce ✅

```
Backend (route.ts)                Frontend (use-custom-chat.ts)           UI (message.tsx)
─────────────────                 ──────────────────────────────           ────────────────

sendEvent({
  type: "text-delta",
  delta: "Hello"
}) ────────────────────────────>  assistantMessage = {                    
                                    ...assistantMessage,                  
                                    content: assistantMessage.content + "Hello"
                                  }
                                  ✅ Nowy obiekt!
                                  
                                  currentMessageRef.current = assistantMessage
                                  ✅ Aktualizacja ref
                                  
                                  setMessages([
                                    ...,
                                    assistantMessage  ← nowy obiekt
                                  ])
                                                                          React.memo sprawdza:
                                                                          - content? ✓ (zmieniony)
                                                                          - parts? ✓ (ten sam)
                                                                          
                                                                          ✅ Re-render!
                                                                          ───────────────────
                                                                          [Wyświetla: "Hello"]


sendEvent({
  type: "pre-action-screenshot",
  toolCallId: "123",
  screenshot: "base64..."
}) ────────────────────────────>  assistantMessage = {
                                    ...assistantMessage,
                                    preActionScreenshots: {
                                      ...(assistantMessage.preActionScreenshots || {}),
                                      ["123"]: "base64..."
                                    }
                                  }
                                  ✅ Nowy obiekt message!
                                  ✅ Nowy obiekt preActionScreenshots!
                                  
                                  currentMessageRef.current = assistantMessage
                                  ✅ Aktualizacja ref
                                  
                                  setMessages([
                                    ...,
                                    assistantMessage  ← nowy obiekt
                                  ])
                                  
                                                                          React.memo sprawdza:
                                                                          - content? ✓ (ten sam)
                                                                          - parts? ✓ (ten sam)
                                                                          - preActionScreenshots? ✅ SPRAWDZA! (zmieniony)
                                                                          
                                                                          ✅ Re-render!
                                                                          ───────────────────
                                                                          [Wyświetla screenshot 📸]
```

## Kluczowe różnice

| Aspekt | Przed ❌ | Po ✅ |
|--------|----------|-------|
| **Mutacja stanu** | Bezpośrednia mutacja właściwości | Tworzenie nowych obiektów |
| **Kopiowanie** | Płytka kopia `{ ...obj }` | Głębokie kopiowanie zagnieżdżonych struktur |
| **React.memo** | Nie sprawdza screenshots | Sprawdza wszystkie właściwości |
| **Re-render** | Blokowany dla screenshots | Wywołany dla wszystkich zmian |
| **Wyświetlanie** | Opóźnione do końca | Natychmiastowe (real-time) |

## Przykład zagnieżdżonego kopiowania

### ❌ Przed (Płytka kopia - problem)
```
assistantMessage = {
  content: "Hi",
  parts: [────────┐
    {             │  ← Te same obiekty w pamięci!
      toolInvocation: {...}
    }             │
  ] ──────────────┘
}

{ ...assistantMessage }  ← Nowa referencja do message, ale parts i toolInvocation to te same obiekty!

parts[0].toolInvocation.state = "call"  ← Mutacja oryginału!
```

### ✅ Po (Głębokie kopiowanie - rozwiązanie)
```
assistantMessage = {
  content: "Hi",
  parts: [────────┐         updatedParts = [────────┐
    {             │           {  ← NOWY obiekt      │
      toolInvocation: {...}      toolInvocation: {  │  ← NOWY obiekt
    }             │                ...             │
  ] ──────────────┘              }                 │
}                              ] ──────────────────┘

assistantMessage = {  ← NOWY message
  ...assistantMessage,
  parts: updatedParts  ← NOWA tablica z NOWYMI obiektami
}
```

## Rezultat końcowy

```
Użytkownik wysyła: "Otwórz Firefox"
        ↓
Backend rozpoczyna przetwarzanie
        ↓
┌──────────────────────────────────────┐
│ STREAMING W CZASIE RZECZYWISTYM:    │
│                                      │
│ [0.1s] "Zaraz otwieram..." 📝       │
│ [0.3s] "Firefox..." 📝              │
│ [0.5s] "żeby wyszukać..." 📝        │
│                                      │
│ [1.0s] 📸 Screenshot PRZED           │
│ [1.1s] ⏳ Akcja: left_click          │
│ [1.2s] ⚡ Wykonywanie...             │
│ [1.5s] 📸 Screenshot PO              │
│ [1.6s] ✅ Sukces!                    │
│                                      │
│ [2.0s] "Firefox otwarty!" 📝        │
└──────────────────────────────────────┘

Wszystko widoczne NA ŻYWO, nie po zakończeniu! ✅
```
