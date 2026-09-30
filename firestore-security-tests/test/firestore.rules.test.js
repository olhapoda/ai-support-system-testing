const fs = require('fs');
const path = require('path');
const assert = require('assert'); 
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');

let testEnv;

before(async function () {
  this.timeout(20000);
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-psy-support-app',
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

async function seedUserDoc(uid) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`users/${uid}`).set({ displayName: 'Test User' });
  });
}

async function seedMessage(uid, messageId, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(`conversations/${uid}/messages/${messageId}`).set(data);
  });
}

describe('users/{userId}', () => {
  it('1. користувач читає свій документ: дозволений процес', async () => {
    await seedUserDoc('alice');
    const alice = testEnv.authenticatedContext('alice');
    await assertSucceeds(alice.firestore().doc('users/alice').get());
  });

  it('2. неавтентифікований користувач читає документ: заборонений процес', async () => {
    await seedUserDoc('alice');
    const anon = testEnv.unauthenticatedContext();
    await assertFails(anon.firestore().doc('users/alice').get());
  });

  it('3. чужий користувач читає документ Alice: заборонений процес', async () => {
    await seedUserDoc('alice');
    const bob = testEnv.authenticatedContext('bob');
    await assertFails(bob.firestore().doc('users/alice').get());
  });

  it('4. користувач оновлює свій документ: дозволений процес', async () => {
    await seedUserDoc('alice');
    const alice = testEnv.authenticatedContext('alice');
    await assertSucceeds(
      alice.firestore().doc('users/alice').update({ displayName: 'Alice Updated' })
    );
  });

  it('5. чужий користувач оновлює документ Alice: заборонений процес', async () => {
    await seedUserDoc('alice');
    const bob = testEnv.authenticatedContext('bob');
    await assertFails(bob.firestore().doc('users/alice').update({ displayName: 'Hacked' }));
  });

  it('6. неавтентифікований користувач створює документ: заборонений процес', async () => {
    const anon = testEnv.unauthenticatedContext();
    await assertFails(anon.firestore().doc('users/eve').set({ displayName: 'Eve' }));
  });
});

describe('conversations/{userId}/messages/{messageId}', () => {
  it('7. користувач створює повідомлення з правильним senderId: дозволений процес', async () => {
    const alice = testEnv.authenticatedContext('alice');
    await assertSucceeds(
      alice
        .firestore()
        .doc('conversations/alice/messages/msg1')
        .set({ text: 'Привіт', senderId: 'alice', createdAt: Date.now() })
    );
  });

  it('8. користувач підміняє senderId у payload: заборонений процес', async () => {
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(
      alice
        .firestore()
        .doc('conversations/alice/messages/msg2')
        .set({ text: 'Привіт', senderId: 'bob', createdAt: Date.now() })
    );
  });

  it('9. чужий користувач створює повідомлення в розмові Alice: заборонений процес', async () => {
    const bob = testEnv.authenticatedContext('bob');
    await assertFails(
      bob
        .firestore()
        .doc('conversations/alice/messages/msg3')
        .set({ text: 'Втручання', senderId: 'bob', createdAt: Date.now() })
    );
  });

  it('10. неавтентифікований користувач створює повідомлення: заборонений процес', async () => {
    const anon = testEnv.unauthenticatedContext();
    await assertFails(
      anon
        .firestore()
        .doc('conversations/alice/messages/msg4')
        .set({ text: 'Анонім', senderId: 'alice', createdAt: Date.now() })
    );
  });

  it('11. користувач читає свою історію розмови: дозволений процес', async () => {
    await seedMessage('alice', 'msg5', { text: 'Вітаю', senderId: 'alice' });
    const alice = testEnv.authenticatedContext('alice');
    await assertSucceeds(alice.firestore().doc('conversations/alice/messages/msg5').get());
  });

  it('12. чужий користувач читає розмову Alice: заборонений процес', async () => {
    await seedMessage('alice', 'msg6', { text: 'Приватне', senderId: 'alice' });
    const bob = testEnv.authenticatedContext('bob');
    await assertFails(bob.firestore().doc('conversations/alice/messages/msg6').get());
  });

  it('13. користувач намагається редагувати повідомлення: заборонений процес (незмінний журнал)', async () => {
    await seedMessage('alice', 'msg7', { text: 'Оригінал', senderId: 'alice' });
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(
      alice.firestore().doc('conversations/alice/messages/msg7').update({ text: 'Змінено' })
    );
  });

  it('14. користувач намагається видалити повідомлення: заборонений процес', async () => {
    await seedMessage('alice', 'msg8', { text: 'Не видаляти', senderId: 'alice' });
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(alice.firestore().doc('conversations/alice/messages/msg8').delete());
  });

  it('15. створення повідомлення без поля senderId: заборонений процес', async () => {
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(
      alice.firestore().doc('conversations/alice/messages/msg9').set({ text: 'Без senderId' })
    );
  });
});

describe('шляхи поза описаною схемою', () => {
  it('16. читання та запис у нерелевантну колекцію: заборонений процес за замовчуванням', async () => {
    const alice = testEnv.authenticatedContext('alice');
    const db = alice.firestore();
    await assertFails(db.doc('admin_config/settings').get());
    await assertFails(db.doc('admin_config/settings').set({ hacked: true }));
  });
});

describe('цілісність та валідація даних', () => {
  it('17. перезапис існуючого повідомлення через set(): заборонений процес', async () => {
    await seedMessage('alice', 'msg10', { text: 'Оригінал', senderId: 'alice' });
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(
      alice
        .firestore()
        .doc('conversations/alice/messages/msg10')
        .set({ text: 'Перезаписано', senderId: 'alice' })
    );
  });

  it('18. створення повідомлення з порожнім текстом: заборонений процес', async () => {
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(
      alice
        .firestore()
        .doc('conversations/alice/messages/msg11')
        .set({ text: '', senderId: 'alice', createdAt: Date.now() })
    );
  });

  it('19. створення повідомлення з текстом, що перевищує ліміт довжини,: заборонений процес', async () => {
    const alice = testEnv.authenticatedContext('alice');
    const longText = 'а'.repeat(4001);
    await assertFails(
      alice
        .firestore()
        .doc('conversations/alice/messages/msg12')
        .set({ text: longText, senderId: 'alice', createdAt: Date.now() })
    );
  });

  it('20. створення повідомлення з великим обсягом даних у незадекларованому полі: заборонений процес', async () => {
    const alice = testEnv.authenticatedContext('alice');
    const hugePayload = 'x'.repeat(500_000);
    await assertFails(
      alice
        .firestore()
        .doc('conversations/alice/messages/msg13')
        .set({
          text: 'Звичайний текст',
          senderId: 'alice',
          createdAt: Date.now(),
          payload: hugePayload,
        })
    );
  });
});

describe('обмеження на рівні платформи Firestore', () => {
  it('21. документ, що перевищує вбудований ліміт розміру Firestore через додаткове поле: заборонений процес незалежно від бізнес-правил', async () => {
    const alice = testEnv.authenticatedContext('alice');
    const oversizedField = 'x'.repeat(1_100_000);
    await assert.rejects(
      alice
        .firestore()
        .doc('conversations/alice/messages/msg13')
        .set({
          text: 'Короткий валідний текст',
          senderId: 'alice',
          createdAt: Date.now(),
          extra: oversizedField,
        })
    );
  });
});
