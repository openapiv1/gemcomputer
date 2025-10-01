# Fix dla problemu z czatem - wyświetlanie na żywo

## Problem
Czat nie wyświetlał wiadomości od AI i wykonywanych akcji w czasie rzeczywistym podczas wykonywania zadania. Wszystkie wiadomości pojawiały się dopiero po zakończeniu całego zadania.

## Przyczyny problemu

### 1. React.memo nie sprawdzał zmian w zrzutach ekranu
W `components/message.tsx`, komponent `PreviewMessage` używał `React.memo` z niestandardową funkcją porównania. Jednak ta funkcja nie sprawdzała zmian w `preActionScreenshots` i `postActionScreenshots`:

```typescript
// PRZED POPRAWKĄ
export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.status !== nextProps.status) return false;
    if (prevProps.message.content !== nextProps.message.content) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    // BRAK sprawdzenia preActionScreenshots i postActionScreenshots!
    return true;
  },
);
```

Skutek: Gdy dodawano zrzuty ekranu, React.memo blokował re-render, więc użytkownik nie widział ich na żywo.

### 2. Mutacja zagnieżdżonych obiektów w use-custom-chat.ts
W `lib/use-custom-chat.ts`, kod bezpośrednio mutował zagnieżdżone obiekty zamiast tworzyć nowe referencje:

```typescript
// PRZED POPRAWKĄ - przykład 1: mutacja zawartości
assistantMessage.content += data.delta;
setMessages((prev) => {
  const newMessages = [...prev];
  newMessages[newMessages.length - 1] = { ...assistantMessage };
  return newMessages;
});
```

Problem: `{ ...assistantMessage }` tworzy płytką kopię, ale właściwości jak `parts`, `preActionScreenshots` i `postActionScreenshots` wciąż wskazują na te same obiekty/tablice.

```typescript
// PRZED POPRAWKĄ - przykład 2: mutacja zagnieżdżonego obiektu
const toolPart = assistantMessage.parts?.find(...);
if (toolPart?.type === "tool-invocation") {
  toolPart.toolInvocation.toolName = data.toolName;  // Bezpośrednia mutacja!
  setMessages(...);
}
```

Problem: Znajdujemy obiekt w tablicy i mutujemy go bezpośrednio. React może nie wykryć tej zmiany, ponieważ referencja do tablicy pozostaje ta sama.

```typescript
// PRZED POPRAWKĄ - przykład 3: mutacja słownika zrzutów ekranu
if (!assistantMessage.preActionScreenshots) {
  assistantMessage.preActionScreenshots = {};
}
assistantMessage.preActionScreenshots[data.toolCallId] = data.screenshot;
setMessages((prev) => {
  const newMessages = [...prev];
  newMessages[newMessages.length - 1] = { ...assistantMessage };
  return newMessages;
});
```

Problem: Mutujemy obiekt `preActionScreenshots` bezpośrednio. Płytka kopia `{ ...assistantMessage }` kopiuje referencję do tego samego obiektu, więc React nie widzi zmiany.

## Rozwiązanie

### 1. Naprawiono React.memo w components/message.tsx
Dodano sprawdzanie zmian w zrzutach ekranu:

```typescript
// PO POPRAWCE
export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.status !== nextProps.status) return false;
    if (prevProps.message.content !== nextProps.message.content) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.message.preActionScreenshots, nextProps.message.preActionScreenshots)) return false;
    if (!equal(prevProps.message.postActionScreenshots, nextProps.message.postActionScreenshots)) return false;
    return true;
  },
);
```

### 2. Naprawiono niezmienność stanu w lib/use-custom-chat.ts

#### Aktualizacja zawartości (content)
```typescript
// PO POPRAWCE
if (data.type === "text-delta") {
  assistantMessage = {
    ...assistantMessage,
    content: assistantMessage.content + data.delta
  };
  currentMessageRef.current = assistantMessage;
  setMessages((prev) => {
    const newMessages = [...prev];
    newMessages[newMessages.length - 1] = assistantMessage;
    return newMessages;
  });
}
```

#### Aktualizacja części narzędzia (tool parts)
```typescript
// PO POPRAWCE
else if (data.type === "tool-name-delta") {
  const toolPartIndex = assistantMessage.parts?.findIndex(
    (p: any) => p.type === "tool-invocation" && p.toolInvocation.toolCallId === data.toolCallId
  );
  if (toolPartIndex !== undefined && toolPartIndex !== -1 && assistantMessage.parts) {
    const toolPart = assistantMessage.parts[toolPartIndex];
    if (toolPart?.type === "tool-invocation") {
      const updatedParts = [...assistantMessage.parts];  // Nowa tablica
      updatedParts[toolPartIndex] = {
        ...toolPart,  // Nowy obiekt part
        toolInvocation: {
          ...toolPart.toolInvocation,  // Nowy obiekt invocation
          toolName: data.toolName
        }
      };
      assistantMessage = {
        ...assistantMessage,  // Nowy obiekt message
        parts: updatedParts
      };
      currentMessageRef.current = assistantMessage;
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = assistantMessage;
        return newMessages;
      });
    }
  }
}
```

#### Aktualizacja zrzutów ekranu
```typescript
// PO POPRAWCE
else if (data.type === "pre-action-screenshot") {
  assistantMessage = {
    ...assistantMessage,
    preActionScreenshots: {
      ...(assistantMessage.preActionScreenshots || {}),  // Nowy obiekt słownika
      [data.toolCallId]: data.screenshot
    }
  };
  currentMessageRef.current = assistantMessage;
  setMessages((prev) => {
    const newMessages = [...prev];
    newMessages[newMessages.length - 1] = assistantMessage;
    return newMessages;
  });
}
```

## Kluczowe zasady niezmienności

1. **Nigdy nie mutuj obiektów bezpośrednio** - zawsze twórz nowe obiekty/tablice
2. **Twórz nowe referencje dla zagnieżdżonych struktur** - spread operator (`...`) działa tylko na jednym poziomie
3. **Aktualizuj `currentMessageRef.current`** - aby zachować spójność między ref a stanem
4. **Używaj nowego obiektu bezpośrednio** - zamiast `{ ...assistantMessage }`, po prostu `assistantMessage`

## Efekt

Po zastosowaniu tych poprawek:
- ✅ Wiadomości tekstowe pojawiają się token po tokenie w czasie rzeczywistym
- ✅ Akcje są widoczne w momencie ich inicjalizacji
- ✅ Argumenty akcji aktualizują się na bieżąco podczas streamingu
- ✅ Zrzuty ekranu pojawiają się natychmiast po ich wykonaniu
- ✅ Statusy akcji (pending → executing → success) są widoczne na żywo
- ✅ Komponenty React prawidłowo wykrywają wszystkie zmiany i renderują się na bieżąco

## Nie zmieniono

Zgodnie z wymaganiami, NIE zmieniono:
- ❌ Sposób działania AI
- ❌ Integracji AI z E2B
- ❌ Logiki wykonywania akcji w sandboxie
- ❌ Struktury eventów SSE z backendu
- ❌ API endpointów

Wszystkie zmiany dotyczą **tylko** komponentu czatu i sposobu aktualizacji stanu React.
