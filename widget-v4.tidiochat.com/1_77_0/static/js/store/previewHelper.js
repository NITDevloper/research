import { trans } from '../helpers/translations';

export function generateMessagesForOpenView() {
    const messages = [
        // {
        //     id: 'a97b905f-17dd-4324-80fc-5cedf77a1552',
        //     type: 'preChat',
        //     content: 'Please introduce yourself:',
        //     sender: 'operator',
        //     time_sent: 1528199108,
        //     disabled: false,
        //     preChatFields: [
        //         {
        //             type: 'email',
        //             placeholder: 'Why you do dis',
        //         },
        //         {
        //             type: 'name',
        //             placeholder: 'name whatever',
        //         },
        //         {
        //             type: 'phone',
        //             placeholder: 'phone costam',
        //         },
        //     ],
        // },
        // {
        //     id: 'c10d8860-7aba-4b59-8f49-25bc50934461',
        //     type: 'alwaysOnline',
        //     content: 'hello@dadsad.dasdasdsad',
        //     sender: 'operator',
        //     time_sent: 1528199542,
        //     disabled: true,
        // },
        {
            id: 'a793989e-dc69-48c3-bf3b-16e71242cc70',
            type: 'text',
            sender: 'visitor',
            isDelivered: true,
            idFromServer: 28776711,
            content: trans('Hi again'),
            time_sent: Date.now() / 1000 - 360,
        },
        {
            id: '634f79ba-1794-4184-b5e6-303d934cba50',
            type: 'text',
            sender: 'visitor',
            isDelivered: true,
            idFromServer: 28776712,
            content: trans('Do you have those'),
            time_sent: Date.now() / 1000 - 300,
        },
        {
            id: 'f72b15d1-4ccf-4891-9f11-ea82b52b2d02',
            idFromServer: 28776714,
            type: 'text',
            content: trans('Hello'),
            sender: 'operator',
            operator_id: null,
            time_sent: Date.now() / 1000 - 240,
        },
        {
            id: '8519cb61-83ee-42fd-bdc3-1baea13160b6',
            type: 'text',
            sender: 'visitor',
            isDelivered: true,
            idFromServer: 28776715,
            content: trans("I've been looking for"),
            time_sent: Date.now() / 1000 - 180,
        },
        {
            id: '5d482850-e480-4a49-9ae6-9fb2089f7149',
            idFromServer: 28776716,
            type: 'text',
            content: trans('Let me check that'),
            sender: 'operator',
            operator_id: null,
            time_sent: Date.now() / 1000 - 120,
        },
        {
            id: 'd84cf615-015c-4732-b28e-f27447997baf',
            type: 'text',
            sender: 'visitor',
            isDelivered: true,
            idFromServer: 28776717,
            content: trans("That's great!"),
            time_sent: Date.now() / 1000 - 60,
        },
        {
            id: '22597c81-a32b-4f09-9a86-10afd82865c9',
            type: 'text',
            sender: 'visitor',
            isDelivered: true,
            idFromServer: 28776718,
            content: trans('Thank you very much!'),
            time_sent: Date.now() / 1000,
        },
    ];
    return messages;
}

export const changeOperatorIdToFirstOperator = (messages, operatorId) =>
    messages.map(message => {
        if (message.sender === 'operator') {
            return {
                ...message,
                operator_id: operatorId,
            };
        }
        return message;
    });
