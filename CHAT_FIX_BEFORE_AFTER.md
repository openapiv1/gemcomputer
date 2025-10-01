# Przed i Po - Porównanie zmian dla poprawki czatu

## 1. components/message.tsx - React.memo comparison

### ❌ PRZED (Problem)
```typescript
export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.status !== nextProps.status) return false;
    if (prevProps.message.content !== nextProps.message.content) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    // 🔴 BRAK sprawdzenia preActionScreenshots i postActionScreenshots
    return true;
  },
);
```

**Problem:** Gdy dodawano zrzuty ekranu, React.memo zwracało `true` (nie renderuj ponownie), więc zrzuty nie były widoczne na żywo.

### ✅ PO (Rozwiązanie)
```typescript
export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.status !== nextProps.status) return false;
    if (prevProps.message.content !== nextProps.message.content) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    // ✅ Dodano sprawdzanie zrzutów ekranu
    if (!equal(prevProps.message.preActionScreenshots, nextProps.message.preActionScreenshots)) return false;
    if (!equal(prevProps.message.postActionScreenshots, nextProps.message.postActionScreenshots)) return false;
    return true;
  },
);
```

**Rozwiązanie:** Teraz memo sprawdza wszystkie właściwości wiadomości, włączając zrzuty ekranu. Komponent re-renderuje się gdy tylko zrzuty są dodawane.

---

## 2. lib/use-custom-chat.ts - Aktualizacja tekstu

### ❌ PRZED (Problem)
```typescript
if (data.type === "text-delta") {
  // 🔴 Bezpośrednia mutacja obiektu
  assistantMessage.content += data.delta;
  
  setMessages((prev) => {
    const newMessages = [...prev];
    // 🔴 Płytka kopia - może nie wywołać re-render
    newMessages[newMessages.length - 1] = { ...assistantMessage };
    return newMessages;
  });
}
```

**Problem:** 
1. Mutacja `assistantMessage.content` bezpośrednio
2. Użycie płytkiej kopii `{ ...assistantMessage }` może nie wywołać re-renderu w React 19 z batching

### ✅ PO (Rozwiązanie)
```typescript
if (data.type === "text-delta") {
  // ✅ Tworzenie nowego obiektu (niezmienność)
  assistantMessage = {
    ...assistantMessage,
    content: assistantMessage.content + data.delta
  };
  // ✅ Aktualizacja ref
  currentMessageRef.current = assistantMessage;
  
  setMessages((prev) => {
    const newMessages = [...prev];
    // ✅ Bezpośrednie użycie nowego obiektu
    newMessages[newMessages.length - 1] = assistantMessage;
    return newMessages;
  });
}
```

**Rozwiązanie:** 
1. Tworzenie nowego obiektu wiadomości z zaktualizowaną zawartością
2. Aktualizacja ref dla spójności
3. Bezpośrednie użycie nowego obiektu gwarantuje wykrycie zmian przez React

---

## 3. lib/use-custom-chat.ts - Aktualizacja nazwy narzędzia

### ❌ PRZED (Problem)
```typescript
else if (data.type === "tool-name-delta") {
  // 🔴 Znajdowanie obiektu w tablicy
  const toolPart = assistantMessage.parts?.find(
    (p: any) => p.type === "tool-invocation" && p.toolInvocation.toolCallId === data.toolCallId
  );
  
  if (toolPart?.type === "tool-invocation") {
    // 🔴 Bezpośrednia mutacja zagnieżdżonego obiektu
    toolPart.toolInvocation.toolName = data.toolName;
    
    setMessages((prev) => {
      const newMessages = [...prev];
      // 🔴 Płytka kopia - parts wskazuje na tę samą tablicę z tym samym obiektem
      newMessages[newMessages.length - 1] = { ...assistantMessage };
      return newMessages;
    });
  }
}
```

**Problem:** 
1. Mutacja zagnieżdżonego obiektu `toolPart.toolInvocation.toolName`
2. Płytka kopia nie tworzy nowych referencji dla `parts` i obiektów wewnątrz
3. React może nie wykryć zmiany, ponieważ referencje do tablicy i obiektów pozostają te same

### ✅ PO (Rozwiązanie)
```typescript
else if (data.type === "tool-name-delta") {
  // ✅ Znajdowanie INDEKSU zamiast obiektu
  const toolPartIndex = assistantMessage.parts?.findIndex(
    (p: any) => p.type === "tool-invocation" && p.toolInvocation.toolCallId === data.toolCallId
  );
  
  if (toolPartIndex !== undefined && toolPartIndex !== -1 && assistantMessage.parts) {
    const toolPart = assistantMessage.parts[toolPartIndex];
    
    if (toolPart?.type === "tool-invocation") {
      // ✅ Tworzenie nowej tablicy parts
      const updatedParts = [...assistantMessage.parts];
      
      // ✅ Tworzenie nowego obiektu toolPart z nowym toolInvocation
      updatedParts[toolPartIndex] = {
        ...toolPart,
        toolInvocation: {
          ...toolPart.toolInvocation,
          toolName: data.toolName
        }
      };
      
      // ✅ Tworzenie nowego obiektu message z nową tablicą parts
      assistantMessage = {
        ...assistantMessage,
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

**Rozwiązanie:** 
1. Tworzenie nowej tablicy `updatedParts`
2. Tworzenie nowego obiektu `toolPart` z nowym `toolInvocation`
3. Tworzenie nowego obiektu `assistantMessage` z nową tablicą
4. Wszystkie referencje są nowe, więc React gwarantowanie wykrywa zmianę

---

## 4. lib/use-custom-chat.ts - Aktualizacja zrzutów ekranu

### ❌ PRZED (Problem)
```typescript
else if (data.type === "pre-action-screenshot") {
  // 🔴 Tworzenie obiektu tylko jeśli nie istnieje
  if (!assistantMessage.preActionScreenshots) {
    assistantMessage.preActionScreenshots = {};
  }
  // 🔴 Bezpośrednia mutacja słownika
  assistantMessage.preActionScreenshots[data.toolCallId] = data.screenshot;
  
  setMessages((prev) => {
    const newMessages = [...prev];
    // 🔴 Płytka kopia - preActionScreenshots wskazuje na ten sam obiekt
    newMessages[newMessages.length - 1] = { ...assistantMessage };
    return newMessages;
  });
}
```

**Problem:** 
1. Mutacja słownika `preActionScreenshots` bezpośrednio
2. Płytka kopia zachowuje referencję do tego samego słownika
3. React może nie wykryć dodania nowego zrzutu ekranu

### ✅ PO (Rozwiązanie)
```typescript
else if (data.type === "pre-action-screenshot") {
  // ✅ Tworzenie nowego obiektu message z nowym słownikiem screenshots
  assistantMessage = {
    ...assistantMessage,
    preActionScreenshots: {
      // ✅ Kopiowanie istniejących zrzutów (jeśli są)
      ...(assistantMessage.preActionScreenshots || {}),
      // ✅ Dodawanie nowego zrzutu
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

**Rozwiązanie:** 
1. Tworzenie nowego słownika z spread operatorem
2. Tworzenie nowego obiektu wiadomości
3. Wszystkie referencje są nowe, więc React wykrywa zmianę
4. Teraz React.memo też wykryje zmianę (dzięki poprawce w punkcie 1)

---

## Wzorzec niezmienności (Immutability Pattern)

### ❌ ZŁE
```typescript
// Mutacja bezpośrednia
obj.property = newValue;
arr.push(newItem);
nested.obj.property = newValue;

// Płytka kopia nie pomaga z zagnieżdżonymi strukturami
const copy = { ...obj };  // Zagnieżdżone obiekty wciąż są te same
```

### ✅ DOBRE
```typescript
// Tworzenie nowych obiektów
const newObj = { ...obj, property: newValue };

// Tworzenie nowych tablic
const newArr = [...arr, newItem];

// Tworzenie nowych zagnieżdżonych struktur
const newObj = {
  ...obj,
  nested: {
    ...obj.nested,
    property: newValue
  }
};
```

---

## Podsumowanie zmian

| Plik | Linie zmienione | Cel |
|------|-----------------|-----|
| `components/message.tsx` | +2 | Dodanie sprawdzania zrzutów ekranu w React.memo |
| `lib/use-custom-chat.ts` | +133, -54 | Zapewnienie niezmienności dla wszystkich aktualizacji stanu |

**Całkowity wpływ:** 187 linii zmienionych w 2 plikach

**Rezultat:** Czat teraz wyświetla wszystkie wiadomości, akcje i zrzuty ekranu w czasie rzeczywistym podczas wykonywania zadania przez AI! 🎉
