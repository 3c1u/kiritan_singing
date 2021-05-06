# -*- coding: utf-8 -*-

# Requires https://github.com/CODEJIN/HiFiSinger.
# 
# Usage:
# $ python -m utils.generate_metadata

import os
import pickle
import math
import numpy as np
import yaml
import argparse
from typing import Any, TypedDict, List
from thirdparty.HiFiSinger.Audio import Audio_Prep, Mel_Generate
from thirdparty.HiFiSinger.yin import pitch_calc
from tqdm import tqdm

Pattern = TypedDict('Pattern', {
    'Audio': np.ndarray,
    'Mel': np.ndarray,
    'Silence': np.ndarray,
    'Pitch': np.ndarray,
    'Duration': List[float],
    'Text': List[str],
    'Note': List[str],
    'Singer': str,
    'Dataset': str,
})

def generate_pattern(hyper_paramters: Any):
    min_Duration, max_Duration = math.inf, -math.inf
    min_Note, max_Note = math.inf, -math.inf

    for index in range(1, 51):
        idx_str = str(index).zfill(2)
        wav_path = f'wav/{idx_str}.wav'
        label_path = f'mono_label_with_note/{idx_str}.txt'
        # (duration, lyric, note)
        music = []
        current_time = 0.0

        # load label
        with open(label_path) as f:
            while True:
                l = f.readline()

                if l == '' or not l:
                    break

                [start_time, lyric, note] = l.split(',')

                start_time = float(start_time)
                note = int(note)

                # match to the HiFiSinger implementation
                if lyric == 'pau':
                    lyric = '<X>'

                music.append((start_time - current_time, lyric, note))
                current_time = start_time

        # load audio
        audio = Audio_Prep(wav_path, hyper_paramters.Sound.Sample_Rate)

        # trim silences
        if music[0][1] == '<X>':
            audio = audio[int(
                music[0][0] * hyper_paramters.Sound.Sample_Rate):]
            music = music[1:]
        if music[-1][1] == '<X>':
            audio = audio[:-int(music[-1][0] *
                                hyper_paramters.Sound.Sample_Rate)]
            music = music[:-1]

        previous_Used = 0
        absolute_Position = 0
        mel_Based = []
        for x in music:
            duration = int(
                x[0] * hyper_paramters.Sound.Sample_Rate) + previous_Used
            previous_Used = duration % hyper_paramters.Sound.Frame_Shift
            duration = duration // hyper_paramters.Sound.Frame_Shift
            # TODO:
            mel_Based.append((absolute_Position, duration, x[1], x[2]))
            absolute_Position += duration
        music = mel_Based

        mel = Mel_Generate(
            audio,
            sample_rate=hyper_paramters.Sound.Sample_Rate,
            num_mel=hyper_paramters.Sound.Mel_Dim,
            num_frequency=hyper_paramters.Sound.Spectrogram_Dim,
            window_length=hyper_paramters.Sound.Frame_Length,
            hop_length=hyper_paramters.Sound.Frame_Shift,
            mel_fmin=hyper_paramters.Sound.Mel_F_Min,
            mel_fmax=hyper_paramters.Sound.Mel_F_Max,
            max_abs_value=hyper_paramters.Sound.Max_Abs_Mel
        )[:absolute_Position]

        pitch = pitch_calc(
            sig=audio,
            sr=hyper_paramters.Sound.Sample_Rate,
            w_len=hyper_paramters.Sound.Frame_Length,
            w_step=hyper_paramters.Sound.Frame_Shift,
            f0_min=hyper_paramters.Sound.F0_Min,
            f0_max=hyper_paramters.Sound.F0_Max,
            confidence_threshold=hyper_paramters.Sound.Confidence_Threshold,
            gaussian_smoothing_sigma=hyper_paramters.Sound.Gaussian_Smoothing_Sigma
        )[:absolute_Position] / hyper_paramters.Sound.F0_Max

        silence = np.where(np.mean(mel, axis=1) < -3.5, np.zeros_like(
            np.mean(mel, axis=1)), np.ones_like(np.mean(mel, axis=1)))

        pattern_Index = 0
        for start_Index in tqdm(range(len(music)), desc=os.path.basename(wav_path)):
            for end_Index in range(start_Index + 1, len(music), 5):
                music_Sample = music[start_Index:end_Index]
                sample_Length = music_Sample[-1][0] + \
                    music_Sample[-1][1] - music_Sample[0][0]
                if sample_Length < hyper_paramters.Min_Duration:
                    continue
                elif sample_Length > hyper_paramters.Max_Duration:
                    break

                audio_Sample = audio[music_Sample[0][0] * hyper_paramters.Sound.Frame_Shift:(
                    music_Sample[-1][0] + music_Sample[-1][1]) * hyper_paramters.Sound.Frame_Shift]
                mel_Sample = mel[music_Sample[0][0]:music_Sample[-1][0] + music_Sample[-1][1]]
                silence_Sample = silence[music_Sample[0][0]:music_Sample[-1][0] + music_Sample[-1][1]]
                pitch_Sample = pitch[music_Sample[0][0]:music_Sample[-1][0] + music_Sample[-1][1]]

                _, duration_Sample, text_Sample, Note_Sample = zip(
                    *music_Sample)

                pattern = {
                    'Audio': audio_Sample.astype(np.float32),
                    'Mel': mel_Sample.astype(np.float32),
                    'Silence': silence_Sample.astype(np.uint8),
                    'Pitch': pitch_Sample.astype(np.float32),
                    'Duration': duration_Sample,
                    'Text': text_Sample,
                    'Note': Note_Sample,
                    'Singer': 'Kiritan',
                    'Dataset': 'kiritan',
                }

                pattern_Path = os.path.join(
                    hyper_paramters.Train.Train_Pattern.Path if np.random.rand(
                    ) > 0.001 else hyper_paramters.Train.Eval_Pattern.Path,
                    'kiritan',
                    '{:03d}'.format(index),
                    'kiritan.S_{:03d}.P_{:05d}.pickle'.format(
                        index, pattern_Index)
                ).replace('\\', '/')
                os.makedirs(os.path.dirname(pattern_Path), exist_ok=True)
                pickle.dump(
                    pattern,
                    open(pattern_Path, 'wb'),
                    protocol=4
                )
                pattern_Index += 1

                min_Duration, max_Duration = min(
                    sample_Length, min_Duration), max(sample_Length, max_Duration)
        min_Note, max_Note = min(
            list(zip(*music))[3] + (min_Note,)), max(list(zip(*music))[3] + (max_Note,))
    # Duration range: 600 - 1500
    # Note range: 0 - 88
    print('Duration range: {} - {}'.format(min_Duration, max_Duration))
    print('Note range: {} - {}'.format(min_Note, max_Note))


def generate_metadata(hp, flag_eval):
    pattern_path = hp.Train.Eval_Pattern.Path if flag_eval else hp.Train.Train_Pattern.Path
    metadata_file = hp.Train.Eval_Pattern.Metadata_File if flag_eval else hp.Train.Train_Pattern.Metadata_File

    metadata = {
        'Spectrogram_Dim': hp.Sound.Spectrogram_Dim,
        'Mel_Dim': hp.Sound.Mel_Dim,
        'Frame_Shift': hp.Sound.Frame_Shift,
        'Frame_Length': hp.Sound.Frame_Length,
        'Sample_Rate': hp.Sound.Sample_Rate,
        'Max_Abs_Mel': hp.Sound.Max_Abs_Mel,
        'Mel_F_Min': hp.Sound.Mel_F_Min,
        'Mel_F_Max': hp.Sound.Mel_F_Max,
        'File_List': [],
        'Audio_Length_Dict': {},
        'Mel_Length_Dict': {},
        'Music_Length_Dict': {},
    }

    files_TQDM = tqdm(
        total=sum([len(files) for root, _, files in os.walk(pattern_path)]),
        desc='Eval_Pattern' if eval else 'Train_Pattern'
    )

    for root, _, files in os.walk(pattern_path):
        for file in files:
            with open(os.path.join(root, file).replace("\\", "/"), "rb") as f:
                pattern_Dict = pickle.load(f)
            file = os.path.join(root, file).replace(
                "\\", "/").replace(pattern_path, '').lstrip('/')
            try:
                if not all([
                    key in pattern_Dict.keys()
                    for key in ('Audio', 'Mel', 'Silence', 'Pitch', 'Duration', 'Text', 'Note', 'Singer', 'Dataset')
                ]):
                    continue
                metadata['Audio_Length_Dict'][file] = pattern_Dict['Audio'].shape[0]
                metadata['Mel_Length_Dict'][file] = pattern_Dict['Mel'].shape[0]
                metadata['Music_Length_Dict'][file] = len(
                    pattern_Dict['Duration'])
                metadata['File_List'].append(file)
            except:
                print(
                    'File \'{}\' is not correct pattern file. This file is ignored.'.format(file))
            files_TQDM.update(1)

    with open(os.path.join(pattern_path, metadata_file.upper()).replace("\\", "/"), 'wb') as f:
        pickle.dump(metadata, f, protocol=4)

    print('Metadata generate done.')


def parse_recursive(args_Dict):
    parsed_Dict = {}
    for key, value in args_Dict.items():
        if isinstance(value, dict):
            value = parse_recursive(value)
        parsed_Dict[key] = value

    args = argparse.Namespace()
    args.__dict__ = parsed_Dict
    return args


if __name__ == '__main__':
    # specify manually
    path_to_hp = './hp/hp_hifisinger.yaml'
    with open(path_to_hp) as f:
        hp = parse_recursive(yaml.load(f, Loader=yaml.Loader))
    # Token_Dict_Generate(hyper_parameters=hp)
    generate_pattern(hyper_paramters=hp)
    generate_metadata(hp, False)
    generate_metadata(hp, True)
