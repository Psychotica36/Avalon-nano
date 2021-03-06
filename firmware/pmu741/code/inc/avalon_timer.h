/*
 * @brief timer head file
 *
 * @note
 *
 * @par
 */
#ifndef __AVALON_TIMER_H_
#define __AVALON_TIMER_H_

typedef void (*TMRPROC)(void);

enum timer_id {
    TIMER_ID1,
    TIMER_ID2,
    TIMER_ID3,
    TIMER_ID4,
    TIMER_ID5,
    TIMER_ID6,
    TIMER_ID7,
    TIMER_ID8,
    TIMER_MAX
};

void timer_init(void);
void timer_set(enum timer_id id, unsigned int interval, TMRPROC tmrcb);
void timer_kill(enum timer_id id);
enum timer_id timer_getready(void);
bool timer_istimeout(enum timer_id id);
unsigned int timer_elapsed(enum timer_id id);
void TIMER32_0_IRQHandler(void);

#endif /* __AVALON_TIMER_H_ */
